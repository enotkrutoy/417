
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
        const SCALE = 2048;
        let w = img.width, h = img.height;
        if (w > SCALE || h > SCALE) {
          const r = Math.min(SCALE/w, SCALE/h);
          w *= r; h *= r;
        }
        canvas.width = w; canvas.height = h;
        if (ctx) {
          ctx.filter = 'contrast(1.2) grayscale(0.2)';
          ctx.drawImage(img, 0, 0, w, h);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const normalizeDate = (v: string): string => {
  const d = v.replace(/\D/g, '');
  if (d.length !== 8) return d;
  // Если формат MMDDYYYY, конвертируем в CCYYMMDD для соответствия стандарту 2020
  if (parseInt(d.substring(4, 8)) > 1900) {
    return d.substring(4, 8) + d.substring(0, 2) + d.substring(2, 4);
  }
  return d;
};

export const scanDLWithGemini = async (base64: string, apiKey: string): Promise<Record<string, string>> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: `Extract US/Canada Driver License data into AAMVA 2020 tags.
                DCS=Last, DAC=First, DAD=Middle.
                Dates (DBA, DBB, DBD) MUST be CCYYMMDD.
                Sex (DBC): 1 for Male, 2 for Female.
                Map 'Audit Number' or 'DD' to DCF.
                DAJ=2-char state. DCG=Country (USA/CAN).
                Return JSON only.` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          DCS: { type: Type.STRING }, DAC: { type: Type.STRING }, DAD: { type: Type.STRING },
          DAQ: { type: Type.STRING }, DBB: { type: Type.STRING }, DBA: { type: Type.STRING },
          DBD: { type: Type.STRING }, DAG: { type: Type.STRING }, DAI: { type: Type.STRING },
          DAJ: { type: Type.STRING }, DAK: { type: Type.STRING }, DBC: { type: Type.STRING },
          DAU: { type: Type.STRING }, DCF: { type: Type.STRING }, DCG: { type: Type.STRING },
          DCA: { type: Type.STRING }, DCB: { type: Type.STRING }, DCD: { type: Type.STRING }
        }
      }
    }
  });

  const raw = JSON.parse(response.text || "{}");
  const result: Record<string, string> = {};
  
  Object.keys(raw).forEach(k => {
    let val = String(raw[k] || "");
    if (['DBA', 'DBB', 'DBD'].includes(k)) val = normalizeDate(val);
    if (k === 'DBC') val = val.startsWith('M') ? '1' : val.startsWith('F') ? '2' : val;
    result[k] = val.toUpperCase();
  });
  
  return result;
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  return JURISDICTIONS.find(j => j.code === (code || "").toUpperCase() && !j.name.includes("Old")) || null;
};
