import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';
import { validateAAMVAStructure } from './validator';
import { generateAAMVAString } from './aamva';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const AAMVA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    DCS: { type: Type.STRING, description: "Family Name. Extract FULL name visible on card (do not truncate)." },
    DAC: { type: Type.STRING, description: "Given Name. Extract FULL name visible on card." },
    DAD: { type: Type.STRING, description: "Middle Name or Initial." },
    DAQ: { type: Type.STRING, description: "License Number / ID Number." },
    DBB: { type: Type.STRING, description: "Date of Birth YYYYMMDD." },
    DBA: { type: Type.STRING, description: "Expiration Date YYYYMMDD." },
    DBD: { type: Type.STRING, description: "Issue Date YYYYMMDD." },
    DAJ: { type: Type.STRING, description: "State/Jurisdiction Code (2 letters, e.g., NY)." },
    DAG: { type: Type.STRING, description: "Address Street 1." },
    DAI: { type: Type.STRING, description: "City." },
    DAK: { type: Type.STRING, description: "Postal Code. For US: extract exactly 9 digits if visible, else 5 digits. (Must be normalized to 9 digits zero-filled + spaces in final output)." },
    DAU: { type: Type.STRING, description: "Height. Convert feet/inches to total inches (e.g., 5'9\" -> 069 IN). Must be '3 digits + space + IN/CM'." },
    DAY: { type: Type.STRING, description: "Eye Color (3 chars, e.g., BRO, BLU, GRN)." },
    DBC: { type: Type.STRING, description: "Sex (1=M, 2=F, 9=X)." },
    DCG: { type: Type.STRING, description: "Country (USA/CAN)." },
    DCF: { type: Type.STRING, description: "Document Discriminator (if present)." },
    DDA: { type: Type.STRING, description: "Compliance Type (F=Real ID, N=Standard)." },
    DCB: { type: Type.STRING, description: "Restrictions. Return 'NONE' if not found." },
    DCD: { type: Type.STRING, description: "Endorsements. Return 'NONE' if not found." }
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
        const MAX_DIM = 2400; 
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
        resolve(canvas.toDataURL('image/jpeg', 0.95).split(',')[1]);
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
 * Upgraded to gemini-3-flash-preview for Matrix Pro 2025
 */
export const scanDLWithGemini = async (
  base64: string, 
  onStatusUpdate?: (status: string) => void
): Promise<any> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Matrix Neural Engine API Key missing");
  
  const ai = new GoogleGenAI({ apiKey });
  let feedback = "";
  
  // AAMVA A.7.7 Reference Examples for One-Shot prompting
  const FEW_SHOT = `
    EXAMPLE 1: "Marie-Louise O'Malley" -> DCS: OMALLEY, DAC: MARIELOUISE
    EXAMPLE 2: "Height: 5'11\"" -> DAU: 071 IN
    EXAMPLE 3: "Zip: 10001" -> DAK: 100010000
  `;

  for (let attempt = 1; attempt <= 2; attempt++) {
    onStatusUpdate?.(attempt === 1 ? "INITIAL NEURAL EXTRACTION..." : "REFINING COMPLIANCE BITSTREAM...");
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: `TASK: Extract AAMVA 2020 Standard compliant fields from the Driver License/ID.
            
            GUIDELINES:
            1. NORMALIZATION: All text must be UPPERCASE. Remove special characters from names.
            2. HEIGHT: Strictly 3 digits (zero-padded) followed by ' IN' or ' CM'.
            3. POSTAL: For USA, exactly 9 digits. Pad with zeros if only 5 digits are found.
            4. DATES: Use YYYYMMDD format.
            
            ${FEW_SHOT}
            
            ${feedback ? `\n\nPREVIOUS ATTEMPT ERRORS (CORRECT THESE):\n${feedback}` : ''}` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: AAMVA_SCHEMA,
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Matrix Neural Engine Offline");
      
      const parsed = JSON.parse(text);
      const sanitized: any = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (v !== null) sanitized[k] = String(v).replace(/[^\x00-\x7F]/g, "").toUpperCase().trim();
      });

      // DSPy Internal Validation Step
      const tempString = generateAAMVAString(sanitized);
      const validation = validateAAMVAStructure(tempString, sanitized);

      if (validation.overallScore >= 95 || attempt === 2) {
        return sanitized;
      }

      feedback = validation.complianceNotes.join("\n");
      await sleep(800); 
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(500);
    }
  }
};