
import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Preprocess image for OCR: resize and convert to base64
 */
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

/**
 * Helper to find jurisdiction by state code (e.g., 'NY', 'CA')
 */
export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  const cleanCode = (code || "").trim().toUpperCase();
  return JURISDICTIONS.find(j => j.code === cleanCode) || null;
};

/**
 * Perform OCR and data extraction using Gemini Vision API
 */
export const scanDLWithGemini = async (
  base64: string, 
  onRetry?: (attempt: number) => void
): Promise<Record<string, string>> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Системный API ключ не обнаружен.");
  
  const ai = new GoogleGenAI({ apiKey });
  const maxRetries = 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0 && onRetry) onRetry(attempt);

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64 } },
              { text: `Analyze the Driver's License or ID card image. 
              Extract all fields according to AAMVA 2020 standard.
              CRITICAL: 
              - Return all dates in YYYYMMDD format for normalization.
              - Map Sex (DBC) to numeric: "1" (Male), "2" (Female), "9" (Unknown).
              - Extract the country identification (DCG) correctly (USA or CAN).
              - Extract the state code (DAJ) as 2 characters.
              - Extract ID number (DAQ), Family Name (DCS), First Name (DAC).
              - Height (DAU) as "5-09" or "175 cm".
              - Output JSON only matching the provided schema.` }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              DCS: { type: Type.STRING, description: "Family Name" },
              DAC: { type: Type.STRING, description: "First Name" },
              DAD: { type: Type.STRING, description: "Middle Name" },
              DAQ: { type: Type.STRING, description: "ID Number" },
              DBB: { type: Type.STRING, description: "DOB (YYYYMMDD)" },
              DBA: { type: Type.STRING, description: "Expiry (YYYYMMDD)" },
              DBD: { type: Type.STRING, description: "Issue (YYYYMMDD)" },
              DAJ: { type: Type.STRING, description: "State Code (2 chars)" },
              DAG: { type: Type.STRING, description: "Street Address" },
              DAI: { type: Type.STRING, description: "City" },
              DAK: { type: Type.STRING, description: "Zip Code" },
              DAU: { type: Type.STRING, description: "Height" },
              DAY: { type: Type.STRING, description: "Eye Color" },
              DBC: { type: Type.STRING, description: "Sex (1/2/9)" },
              DCG: { type: Type.STRING, description: "Country (USA/CAN)" },
              DCF: { type: Type.STRING, description: "Document Discriminator" }
            }
          }
        },
      });

      const text = response.text;
      if (!text) throw new Error("Received empty response from neural link.");
      
      const parsed = JSON.parse(text);
      const result: Record<string, string> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (v !== null && v !== undefined) result[k] = String(v).toUpperCase().trim();
      });
      return result;
    } catch (e) {
      console.error(`Neural extraction attempt ${attempt} failed:`, e);
      if (attempt === maxRetries) throw e;
      await sleep(2000);
    }
  }
  throw new Error("Neural link extraction failed.");
};
