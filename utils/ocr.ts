
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
        const MAX_DIM = 1600; // Оптимально для Gemini Vision
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

export const scanDLWithGemini = async (
  base64: string, 
  customKey?: string, 
  onRetry?: (attempt: number) => void
): Promise<Record<string, string>> => {
  const apiKey = customKey || process.env.API_KEY || "";
  if (!apiKey) throw new Error("API Key Missing");
  
  const ai = new GoogleGenAI({ apiKey });
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64 } },
              { text: `Extract Driver License data according to AAMVA 2020. 
              Output ONLY JSON. Fields: DCS (Last), DAC (First), DAD (Middle), DAQ (ID#), 
              DBB (DOB YYYYMMDD), DBA (Expiry YYYYMMDD), DBD (Issue YYYYMMDD), 
              DAJ (State Code), DAG (Address), DAI (City), DAK (Zip), DCF (Audit/DD), 
              DAU (Height), DAY (Eyes), DDK (Donor 1/0), DDA (RealID F/N), DDL (Veteran 1/0).` }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              DCS: { type: Type.STRING }, DAC: { type: Type.STRING }, DAD: { type: Type.STRING },
              DAQ: { type: Type.STRING }, DBB: { type: Type.STRING }, DBA: { type: Type.STRING },
              DBD: { type: Type.STRING }, DAJ: { type: Type.STRING }, DAG: { type: Type.STRING },
              DAI: { type: Type.STRING }, DAK: { type: Type.STRING }, DCF: { type: Type.STRING },
              DAU: { type: Type.STRING }, DAY: { type: Type.STRING }, DDK: { type: Type.STRING },
              DDA: { type: Type.STRING }, DDL: { type: Type.STRING }
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from Vision Node");
      
      const data = JSON.parse(text);
      const result: Record<string, string> = {};
      
      Object.entries(data).forEach(([k, v]) => {
        if (v) result[k] = String(v).toUpperCase().trim();
      });
      
      return result;

    } catch (e: any) {
      if (attempt < maxRetries) {
        onRetry?.(attempt + 1);
        await sleep(2000);
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
