
import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64 } },
              { text: `Analyze the Driver's License or ID card image. 
              Extract all available fields according to AAMVA 2020 standard.
              CRITICAL: Dates must be in YYYYMMDD format.
              Output JSON only.` }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              DCS: { type: Type.STRING, description: "Last Name" },
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
              DCF: { type: Type.STRING, description: "Document Discriminator/Audit" },
              DAU: { type: Type.STRING, description: "Height (e.g. 5-11)" },
              DAY: { type: Type.STRING, description: "Eye Color (3 chars)" },
              DDK: { type: Type.STRING, description: "Organ Donor (1/0)" },
              DDA: { type: Type.STRING, description: "Compliance (F/N)" }
            },
            required: ["DCS", "DAC", "DAQ", "DAJ"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty Neural Response");
      
      const data = JSON.parse(text);
      const result: Record<string, string> = {};
      
      Object.entries(data).forEach(([k, v]) => {
        if (v !== null && v !== undefined) result[k] = String(v).toUpperCase().trim();
      });
      
      return result;

    } catch (e: any) {
      if (attempt < maxRetries) {
        onRetry?.(attempt + 1);
        await sleep(1500);
        continue;
      }
      throw e;
    }
  }
  throw new Error("Neural Link Failed");
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  const search = (code || "").toUpperCase().trim();
  return JURISDICTIONS.find(j => j.code === search) || null;
};
