
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
        const SCALE = 2500; // Увеличено разрешение для мелкого текста DD
        let w = img.width, h = img.height;
        if (w > SCALE || h > SCALE) {
          const r = Math.min(SCALE/w, SCALE/h);
          w *= r; h *= r;
        }
        canvas.width = w; canvas.height = h;
        if (ctx) {
          ctx.filter = 'contrast(1.2) brightness(1.0) sharp(1.0)';
          ctx.drawImage(img, 0, 0, w, h);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
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
        { text: `Analyze the Driver's License image and extract data into AAMVA 2020 compliant tags.
        
        CRITICAL TAG RULES:
        - DCS: LAST NAME only.
        - DAC: FIRST NAME only.
        - DAD: MIDDLE NAME or initial.
        - DAQ: ID NUMBER exactly as shown (with hyphens if present).
        - DBB: Date of Birth (MMDDCCYY).
        - DBA: Expiry Date (MMDDCCYY).
        - DBD: Issue Date (MMDDCCYY).
        - DCF: DOCUMENT DISCRIMINATOR / AUDIT NUMBER. Usually marked as 'DD' or 'Audit'. This is a long alphanumeric string.
        - DAU: Height (e.g., '5-08' or '5-11').
        - DBC: Sex (1=Male, 2=Female).
        - DAG, DAI, DAJ, DAK: Address components.
        
        If a field is not found, use "NONE". Return JSON.` }
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
          DAY: { type: Type.STRING },
          DAU: { type: Type.STRING },
          DCF: { type: Type.STRING },
          DCA: { type: Type.STRING },
          DCB: { type: Type.STRING },
          DCD: { type: Type.STRING },
          DDA: { type: Type.STRING }
        }
      }
    }
  });

  try {
    const raw = JSON.parse(response.text || "{}");
    const cleaned: Record<string, string> = {};
    
    Object.keys(raw).forEach(key => {
      let val = String(raw[key] || "").toUpperCase().trim();
      if (['DBA', 'DBB', 'DBD'].includes(key)) val = val.replace(/\D/g, '');
      if (key === 'DBC') {
        if (val.includes('M') || val === '1') val = '1';
        else if (val.includes('F') || val === '2') val = '2';
      }
      cleaned[key] = val;
    });

    return cleaned;
  } catch (e) {
    return {};
  }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  return JURISDICTIONS.find(j => j.code === (code || "").toUpperCase() && !j.name.includes("Old")) || null;
};
