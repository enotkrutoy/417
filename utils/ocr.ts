import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

// Standard ANSI D-20 Codes
const EYE_COLORS: Record<string, string> = {
  "BROWN": "BRO", "BLUE": "BLU", "GREEN": "GRN", "HAZEL": "HAZ",
  "BLACK": "BLK", "GRAY": "GRY", "GREY": "GRY", "MAROON": "MAR",
  "PINK": "PNK", "DICHROMATIC": "DIC"
};

const HAIR_COLORS: Record<string, string> = {
  "BROWN": "BRO", "BLOND": "BLN", "BLONDE": "BLN", "BLACK": "BLK",
  "RED": "RED", "WHITE": "WHI", "GRAY": "GRY", "GREY": "GRY",
  "BALD": "BAL", "SANDY": "SDY", "AUBURN": "RED" // Auburn maps to Red usually
};

const normalizeCode = (val: string, map: Record<string, string>): string => {
  if (!val) return "";
  const upper = val.toUpperCase().trim();
  if (map[upper]) return map[upper];
  // If it's already a valid 3-letter code, return it
  if (Object.values(map).includes(upper)) return upper;
  return upper.substring(0, 3); // Fallback
};

export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_DIMENSION = 2048; 
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else if (height > width && height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }

        canvas.width = width;
        canvas.height = height;

        if (!ctx) {
            resolve((event.target?.result as string).split(',')[1]);
            return;
        }
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.filter = 'contrast(1.2) brightness(1.05) saturate(1.1)';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const scanDLWithGemini = async (base64Image: string, apiKey: string): Promise<Record<string, string>> => {
  if (!apiKey) throw new Error("API Key is missing.");
  
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash";

  const response = await ai.models.generateContent({
    model: modelId,
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        {
          text: `Extract data from this US/Canada Driver's License. Return strictly compliant AAMVA PDF417 raw data values.
                 
                 RULES:
                 1. DATES: Format as MMDDYYYY (USA) or CCYYMMDD (Canada). NO separators.
                 2. SEX: Return '1' (Male), '2' (Female).
                 3. HEIGHT: Format as '000 in' (e.g. 5'09" = '069 in').
                 4. EYES/HAIR: Extract the text (e.g. Brown, Blue).
                 5. STATE: 2-letter code.
                 6. ADDRESS: Street, City, Zip (only numbers and hyphen).
                 7. CLASS: License class code.
                 8. RESTRICTIONS/ENDORSEMENTS: Return 'NONE' if empty.
                 `
        }
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
          DAQ: { type: Type.STRING },
          DBB: { type: Type.STRING },
          DBA: { type: Type.STRING },
          DBD: { type: Type.STRING },
          DAG: { type: Type.STRING },
          DAI: { type: Type.STRING },
          DAJ: { type: Type.STRING },
          DAK: { type: Type.STRING },
          DBC: { type: Type.STRING },
          DAU: { type: Type.STRING },
          DAW: { type: Type.STRING },
          DAY: { type: Type.STRING },
          DAZ: { type: Type.STRING },
          DCA: { type: Type.STRING },
          DCB: { type: Type.STRING },
          DCD: { type: Type.STRING },
          DCF: { type: Type.STRING },
          DCG: { type: Type.STRING }
        },
        required: ["DCS", "DAC", "DAQ", "DBB", "DBA", "DAJ"]
      }
    }
  });

  const text = response.text;
  if (!text) return {};

  try {
    const rawData = JSON.parse(text);
    const sanitized: Record<string, string> = {};
    
    Object.keys(rawData).forEach(key => {
        let val = rawData[key];
        if (typeof val === 'number') val = String(val);
        if (typeof val !== 'string') return;
        
        // Post-processing for strict compliance
        if (key === 'DAY') val = normalizeCode(val, EYE_COLORS);
        if (key === 'DAZ') val = normalizeCode(val, HAIR_COLORS);
        if (key === 'DBC') {
             if (val === 'M' || val === 'Male') val = '1';
             if (val === 'F' || val === 'Female') val = '2';
        }
        
        sanitized[key] = val;
    });
    
    return sanitized;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return {};
  }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
    if (!code) return null;
    const upper = code.toUpperCase();
    return JURISDICTIONS.find(j => j.code === upper && !j.name.includes("Old")) || null;
}