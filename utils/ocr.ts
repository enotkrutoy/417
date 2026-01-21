import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_DIM = 1200;
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

export const scanDLWithGemini = async (base64: string, apiKey: string): Promise<Record<string, string>> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: `Extract AAMVA 2020 tags from ID/DL image. 
        Focus on accuracy for:
        - DCS: Last Name, DAC: First, DAD: Middle
        - DAQ: License/ID Number
        - DCF: Document Discriminator (Critical! Often labeled 'Audit', 'DD', or found in corners/back)
        - DBB: DOB, DBA: Expiry, DBD: Issue (Extract numeric only)
        - DAJ: 2-char State Code, DCG: Country (USA/CAN)
        - DAU: Height (e.g., 5-11 or 180 cm)
        - DDA: Compliance (F=Star/RealID, N=None)
        Return strictly JSON.` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          DCS: { type: Type.STRING },
          DAC: { type: Type.STRING },
          DAD: { type: Type.STRING },
          DCU: { type: Type.STRING },
          DAQ: { type: Type.STRING },
          DCF: { type: Type.STRING },
          DBB: { type: Type.STRING },
          DBA: { type: Type.STRING },
          DBD: { type: Type.STRING },
          DAJ: { type: Type.STRING },
          DCG: { type: Type.STRING },
          DAU: { type: Type.STRING },
          DAW: { type: Type.STRING },
          DAY: { type: Type.STRING },
          DAZ: { type: Type.STRING },
          DDA: { type: Type.STRING },
          DDK: { type: Type.STRING }
        }
      }
    }
  });

  try {
    const raw = JSON.parse(response.text || "{}");
    const cleaned: Record<string, string> = {};
    Object.keys(raw).forEach(key => {
      let val = String(raw[key] || "").toUpperCase().trim();
      // Only clean characters from numeric fields, but allow 'X' for sex if needed
      if (['DBA', 'DBB', 'DBD', 'DAW'].includes(key)) val = val.replace(/\D/g, '');
      cleaned[key] = val;
    });
    return cleaned;
  } catch (e) { throw new Error("JSON Parse failure in AI Engine"); }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  return JURISDICTIONS.find(j => j.code === (code || "").toUpperCase()) || null;
};