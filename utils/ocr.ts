import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';
import { validateAAMVAStructure } from './validator';
import { generateAAMVAString } from './aamva';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const AAMVA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    DCS: { type: Type.STRING, description: "Family Name. Apply A.7.7 Truncation sequence internally if > 40 chars." },
    DAC: { type: Type.STRING, description: "Given Name." },
    DAD: { type: Type.STRING, description: "Middle Name or Initial." },
    DAQ: { type: Type.STRING, description: "License Number." },
    DBB: { type: Type.STRING, description: "DOB YYYYMMDD." },
    DBA: { type: Type.STRING, description: "Expiry YYYYMMDD." },
    DBD: { type: Type.STRING, description: "Issue YYYYMMDD." },
    DAJ: { type: Type.STRING, description: "State Code (2 letters)." },
    DAG: { type: Type.STRING, description: "Address Line 1." },
    DAI: { type: Type.STRING, description: "City." },
    DAK: { type: Type.STRING, description: "Postal Code. US: 9 digits with zero-fill if unknown." },
    DAU: { type: Type.STRING, description: "Height in 3 digits + ' IN' or ' CM' (e.g. '070 IN')." },
    DAY: { type: Type.STRING, description: "Eye Color (3 chars)." },
    DBC: { type: Type.STRING, description: "Sex (1=M, 2=F, 9=X)." },
    DCG: { type: Type.STRING, description: "Country (USA/CAN)." },
    DCF: { type: Type.STRING, description: "Document Discriminator." },
    DDA: { type: Type.STRING, description: "Compliance (F/N)." },
    DCB: { type: Type.STRING, description: "Restrictions. Return 'NONE' if not visible." },
    DCD: { type: Type.STRING, description: "Endorsements. Return 'NONE' if not visible." }
  },
  required: ["DCS", "DAC", "DAQ", "DBB", "DAJ", "DCG", "DAK", "DAU"]
};

export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_DIM = 2048; 
        let w = img.width, h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          const r = Math.min(MAX_DIM/w, MAX_DIM/h);
          w *= r; h *= r;
        }
        canvas.width = w; canvas.height = h;
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  const cleanCode = (code || "").trim().toUpperCase();
  return JURISDICTIONS.find(j => j.code === cleanCode) || null;
};

/**
 * DSPy Neural Pipeline: Predict -> Validate -> Refine
 */
export const scanDLWithGemini = async (
  base64: string, 
  onStatusUpdate?: (status: string) => void
): Promise<any> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Neural Engine API Key missing");
  
  const ai = new GoogleGenAI({ apiKey });
  let feedback = "";
  const TRUNCATION_GUIDE = "A.7.7 Reference: Marie - Louise V'Erylongname -> LOUISE VERYLONGNAME (Phase 2: Remove Apostrophes R-to-L).";

  for (let attempt = 1; attempt <= 2; attempt++) {
    onStatusUpdate?.(attempt === 1 ? "NEURAL PREDICTION (AAMVA A.7.7)..." : "DSPy SELF-CORRECTION LOOP...");
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: `TASK: Neural Normalization of AAMVA 2020 Data.
            RULES:
            1. ${TRUNCATION_GUIDE}
            2. HEIGHT (DAU): Return strictly 3-digit inches/cm (e.g., '069 IN').
            3. POSTAL (DAK): 9 digits zero-filled + spaces if ZIP+4 is missing.
            ${feedback ? `\n\nPREVIOUS ERROR FEEDBACK:\n${feedback}` : ''}` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: AAMVA_SCHEMA,
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Neural Engine Offline");
      
      const parsed = JSON.parse(text);
      const sanitized: any = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (v !== null) sanitized[k] = String(v).replace(/[^\x00-\x7F]/g, "").toUpperCase().trim();
      });

      const tempString = generateAAMVAString(sanitized);
      const validation = validateAAMVAStructure(tempString, sanitized);

      if (validation.overallScore >= 98 || attempt === 2) {
        return sanitized;
      }

      feedback = validation.complianceNotes.join("\n");
      await sleep(600); 
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(400);
    }
  }
};