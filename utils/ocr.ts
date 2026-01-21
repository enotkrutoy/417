
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

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  const cleanCode = (code || "").trim().toUpperCase();
  return JURISDICTIONS.find(j => j.code === cleanCode) || null;
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
      if (attempt > 0 && onRetry) onRetry(attempt);

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64 } },
              { text: `Analyze Driver's License/ID. Extract AAMVA 2020 fields.
              Rules:
              - Dates: YYYYMMDD
              - Sex (DBC): "1" (M), "2" (F), "9" (X/Other)
              - Height (DAU): e.g. "5-09" or "175 cm"
              - Country (DCG): USA or CAN
              - State (DAJ): 2-char code
              JSON only.` }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              DCS: { type: Type.STRING },
              DAC: { type: Type.STRING },
              DAD: { type: Type.STRING },
              DAQ: { type: Type.STRING },
              DBB: { type: Type.STRING },
              DBA: { type: Type.STRING },
              DBD: { type: Type.STRING },
              DAJ: { type: Type.STRING },
              DAG: { type: Type.STRING },
              DAI: { type: Type.STRING },
              DAK: { type: Type.STRING },
              DAU: { type: Type.STRING },
              DAY: { type: Type.STRING },
              DBC: { type: Type.STRING },
              DCG: { type: Type.STRING },
              DCF: { type: Type.STRING }
            }
          }
        },
      });

      const text = response.text;
      if (!text) throw new Error("Neural link extraction failed.");
      
      const parsed = JSON.parse(text);
      const result: Record<string, string> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (v) result[k] = String(v).toUpperCase().trim();
      });
      return result;
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await sleep(2000);
    }
  }
  throw new Error("Neural link failed.");
};
