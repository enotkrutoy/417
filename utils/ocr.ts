
import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';
import { validateAAMVAStructure } from './validator';
import { generateAAMVAString } from './aamva';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const AAMVA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    DCS: { type: Type.STRING, description: "Family Name. Extract FULL name even if truncated on card surface." },
    DAC: { type: Type.STRING, description: "Given Name. Extract FULL name if possible." },
    DAD: { type: Type.STRING, description: "Middle Name or Initial." },
    DAQ: { type: Type.STRING, description: "License Number." },
    DBB: { type: Type.STRING, description: "DOB YYYYMMDD." },
    DBA: { type: Type.STRING, description: "Expiry YYYYMMDD." },
    DBD: { type: Type.STRING, description: "Issue YYYYMMDD." },
    DAJ: { type: Type.STRING, description: "State Code (2 letters)." },
    DAG: { type: Type.STRING, description: "Address Line 1." },
    DAI: { type: Type.STRING, description: "City." },
    DAK: { type: Type.STRING, description: "Zip Code (Pure digits for extraction)." },
    DAU: { type: Type.STRING, description: "Height in 3-digit format with unit (e.g., '070 IN' or '178 CM')." },
    DAY: { type: Type.STRING, description: "Eye Color (3 chars: BRO, BLU, etc)." },
    DBC: { type: Type.STRING, description: "Sex (1=M, 2=F, 9=X)." },
    DCG: { type: Type.STRING, description: "Country (USA/CAN)." },
    DCF: { type: Type.STRING, description: "Document Discriminator." },
    DDA: { type: Type.STRING, description: "Compliance (F/N)." },
    DCB: { type: Type.STRING, description: "Restrictions. MUST be 'NONE' if not explicitly found." },
    DCD: { type: Type.STRING, description: "Endorsements. MUST be 'NONE' if not explicitly found." }
  },
  required: ["DCS", "DAC", "DAQ", "DBB", "DAJ", "DCG"]
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

export const scanDLWithGemini = async (
  base64: string, 
  onStatusUpdate?: (status: string) => void
): Promise<any> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Neural Engine API Key missing");
  
  const ai = new GoogleGenAI({ apiKey });
  let feedback = "";

  // NEURAL SELF-CORRECTION LOOP (Predict-Validate-Refine Pattern)
  for (let attempt = 1; attempt <= 2; attempt++) {
    onStatusUpdate?.(attempt === 1 ? "ANALYZING AAMVA A.7.7 CONSTRAINTS..." : "NEURAL SELF-CORRECTION (REFINING DAK/DAU/NAMES)");
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: `TASK: Extract AAMVA 2020 Driver License data for barcode generation. 
            STRICT RULES: 
            1. FULL legal names (DCS/DAC) are required. Use neural inference if parts are truncated.
            2. Mandatory fields DCB and DCD MUST be 'NONE' if no value is on the card.
            3. DAK (Postal Code) must be 5 digits (standard) or 9 digits (extended).
            4. Dates MUST be YYYYMMDD format.
            5. Height (DAU) must be 3 digits + ' IN' or ' CM' (e.g., '070 IN').
            ${feedback ? `\n\nERROR LOGS FROM PREVIOUS ATTEMPT (FIX THESE): \n${feedback}` : ''}` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: AAMVA_SCHEMA,
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Neural Link Offline");
      
      const parsed = JSON.parse(text);
      const sanitized: any = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (v !== null) sanitized[k] = String(v).replace(/[^\x00-\x7F]/g, "").toUpperCase().trim();
      });

      // Internal Validation Step
      const tempString = generateAAMVAString(sanitized);
      const validation = validateAAMVAStructure(tempString, sanitized);

      // EXIT: Perfect compliance or Max attempts
      if (validation.overallScore >= 98 || attempt === 2) {
        return sanitized;
      }

      // FEEDBACK LOOP: Provide error notes back to model
      feedback = validation.complianceNotes.join("\n");
      await sleep(600); 
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(400);
    }
  }
};
