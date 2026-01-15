import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

const EYE_COLORS: Record<string, string> = {
  "BROWN": "BRO", "BLUE": "BLU", "GREEN": "GRN", "HAZEL": "HAZ",
  "BLACK": "BLK", "GRAY": "GRY", "GREY": "GRY", "MAROON": "MAR",
  "PINK": "PNK", "DICHROMATIC": "DIC", "UNKNOWN": "UNK"
};

const HAIR_COLORS: Record<string, string> = {
  "BROWN": "BRO", "BLOND": "BLN", "BLONDE": "BLN", "BLACK": "BLK",
  "RED": "RED", "WHITE": "WHI", "GRAY": "GRY", "GREY": "GRY",
  "BALD": "BAL", "SANDY": "SDY", "AUBURN": "RED", "UNKNOWN": "UNK"
};

const normalizeCode = (val: string, map: Record<string, string>): string => {
  if (!val) return "";
  const upper = val.toUpperCase().trim();
  if (map[upper]) return map[upper];
  for (const key in map) {
      if (upper.includes(key)) return map[key];
  }
  return upper.substring(0, 3);
};

const normalizeHeight = (val: string): string => {
    if (!val) return "";
    const numbers = val.match(/\d+/g);
    if (!numbers) return "";

    if (val.toLowerCase().includes("cm") || (numbers.length === 1 && parseInt(numbers[0]) > 100)) {
        return numbers[0].padStart(3, '0') + " cm";
    }

    let inches = 0;
    if (numbers.length >= 1) inches += parseInt(numbers[0]) * 12;
    if (numbers.length >= 2) inches += parseInt(numbers[1]);
    
    return inches.toString().padStart(3, '0') + " in";
};

const normalizeDate = (val: string): string => {
    if (!val) return "";
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
        // If YYYYMMDD, flip to MMDDYYYY
        if (parseInt(clean.substring(0, 4)) > 1900) {
            return clean.substring(4, 6) + clean.substring(6, 8) + clean.substring(0, 4);
        }
    }
    return clean;
};

export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_DIM = 2048;
        let w = img.width, h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          const ratio = Math.min(MAX_DIM/w, MAX_DIM/h);
          w *= ratio; h *= ratio;
        }
        canvas.width = w; canvas.height = h;
        if (!ctx) return resolve("");
        ctx.filter = 'contrast(1.1) brightness(1.02)';
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const scanDLWithGemini = async (base64Image: string, apiKey: string): Promise<Record<string, string>> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: `Extract all AAMVA data elements. 
                Look specifically for DD (Document Discriminator) or Audit Number and map to DCF.
                Dates: MMDDYYYY. Sex: 1 (M), 2 (F). Height: 5'08'' or 175cm.
                Return JSON.` }
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
          DAU: { type: Type.STRING }, DAW: { type: Type.STRING }, DAY: { type: Type.STRING },
          DAZ: { type: Type.STRING }, DCA: { type: Type.STRING }, DCB: { type: Type.STRING },
          DCD: { type: Type.STRING }, DCF: { type: Type.STRING }, DCG: { type: Type.STRING }
        }
      }
    }
  });

  try {
    const raw = JSON.parse(response.text || "{}");
    const out: Record<string, string> = {};
    Object.keys(raw).forEach(k => {
      let v = String(raw[k] || "");
      if (k === 'DAY') v = normalizeCode(v, EYE_COLORS);
      if (k === 'DAZ') v = normalizeCode(v, HAIR_COLORS);
      if (k === 'DAU') v = normalizeHeight(v);
      if (k.startsWith('DB') || k === 'DEB') v = normalizeDate(v);
      out[k] = v;
    });
    return out;
  } catch (e) { return {}; }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
    return JURISDICTIONS.find(j => j.code === (code || "").toUpperCase() && !j.name.includes("Old")) || null;
}