
import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';
import { validateAAMVAStructure } from './validator';
import { generateAAMVAString } from './aamva';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * DSPy-style Signature definition for AAMVA 2020
 * Strict schema to guide the model's extraction logic.
 */
const AAMVA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    DCS: { type: Type.STRING, description: "Family Name (Last Name). Must be uppercase." },
    DAC: { type: Type.STRING, description: "Given Name (First Name). Must be uppercase." },
    DAD: { type: Type.STRING, description: "Middle Name or Initial. Use 'NONE' if missing." },
    DAQ: { type: Type.STRING, description: "Customer ID Number / License Number." },
    DBB: { type: Type.STRING, description: "Date of Birth in YYYYMMDD format." },
    DBA: { type: Type.STRING, description: "Document Expiration Date in YYYYMMDD format." },
    DBD: { type: Type.STRING, description: "Document Issue Date in YYYYMMDD format." },
    DAJ: { type: Type.STRING, description: "Jurisdiction Code (2-letter state code, e.g., NY, CA)." },
    DAG: { type: Type.STRING, description: "Address Line 1 (Street and House Number)." },
    DAI: { type: Type.STRING, description: "City Name." },
    DAK: { type: Type.STRING, description: "Postal Code (Zip). Usually 5-11 chars." },
    DAU: { type: Type.STRING, description: "Height in feet-inches (e.g. 5-09) or centimeters." },
    DAY: { type: Type.STRING, description: "Eye Color code (3 letters: BRO, BLU, GRN, etc.)." },
    DBC: { type: Type.STRING, description: "Sex: 1 for Male, 2 for Female, 9 for Non-binary/Other." },
    DCG: { type: Type.STRING, description: "Country Code: USA or CAN." },
    DCF: { type: Type.STRING, description: "Document Discriminator (Audit number)." },
    DDA: { type: Type.STRING, description: "Compliance Type: 'F' for REAL ID, 'N' for Non-compliant." }
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

/**
 * DSPy Predict-Validate-Refine Module
 * Uses gemini-2.5-flash to extract data and iterates if validation fails.
 */
export const scanDLWithGemini = async (
  base64: string, 
  onStatusUpdate?: (status: string) => void
): Promise<any> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Neural Engine API Key missing");
  
  const ai = new GoogleGenAI({ apiKey });
  let currentData: any = null;
  let feedback = "";

  // Predict -> Validate -> Refine Loop (Max 2 Attempts)
  for (let attempt = 1; attempt <= 2; attempt++) {
    onStatusUpdate?.(attempt === 1 ? "INITIAL NEURAL PREDICTION (GEMINI 2.5 FLASH)" : "NEURAL REFINEMENT (DSPY FEEDBACK LOOP)");
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: `TASK: Extract AAMVA 2020 driver's license data from the image.
            ${feedback ? `CORRECTION REQUIRED: ${feedback}. Focus on these fields and fix them by re-examining the image.` : 'Extract all elements accurately.'}
            Return JSON. Dates: YYYYMMDD.` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: AAMVA_SCHEMA,
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Null response from inference engine");
      
      const parsed = JSON.parse(text);
      const sanitized: any = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          sanitized[k] = String(v).replace(/[^\x00-\x7F]/g, "").toUpperCase().trim();
        }
      });

      // Metric Phase: Run internal AAMVA validator
      const tempString = generateAAMVAString(sanitized);
      const validation = validateAAMVAStructure(tempString, sanitized);

      onStatusUpdate?.(`VALIDATION SCORE: ${validation.overallScore}%`);
      
      // Stop condition: High confidence or exhaustion
      if (validation.overallScore >= 94 || attempt === 2) {
        return sanitized;
      }

      // Preparation for Refinement
      feedback = validation.complianceNotes.length > 0 
        ? `Found errors: ${validation.complianceNotes.slice(0, 3).join("; ")}` 
        : `Missing or incorrect fields detected: ${validation.fields.filter(f => f.status !== 'MATCH').map(f => f.elementId).join(', ')}`;
      
      currentData = sanitized;
      await sleep(1000); 
    } catch (e) {
      console.warn(`DSPy Link Error (Attempt ${attempt}):`, e);
      if (attempt === 2) throw e;
      await sleep(500);
    }
  }
  
  return currentData;
};
