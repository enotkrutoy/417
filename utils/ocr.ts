
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
        const MAX_DIM = 1600; // Optimized for Flash 2.0
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
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
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
  if (!apiKey) throw new Error("API_KEY missing");
  
  const ai = new GoogleGenAI({ apiKey });
  const maxRetries = 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0 && onRetry) onRetry(attempt);

      // Using gemini-2.0-flash as the most stable current generation
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash', 
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: `Extract AAMVA 2020 data. Output ONLY JSON keys. Do not include image descriptions or extra text.
            Fields: DCS, DAC, DAD, DAQ, DBB, DBA, DBD, DAJ, DAG, DAI, DAK, DAU, DAY, DBC, DCG, DCF.
            Format dates: YYYYMMDD. Sex: 1/2/9.` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 1024, // Prevents the 15k+ char overflow issue
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
      if (!text) throw new Error("Empty neural response");
      
      const parsed = JSON.parse(text);
      const result: Record<string, string> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        // Sanitize to ASCII only to comply with ISO 8859-1 requirements
        if (v) result[k] = String(v).replace(/[^\x00-\x7F]/g, "").toUpperCase().trim();
      });
      return result;
    } catch (e) {
      console.warn(`Attempt ${attempt} failed, retrying...`, e);
      if (attempt === maxRetries) throw e;
      await sleep(1000);
    }
  }
  throw new Error("OCR Failed to stabilize");
};
