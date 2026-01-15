
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
        const SCALE = 2000;
        let w = img.width, h = img.height;
        if (w > SCALE || h > SCALE) {
          const r = Math.min(SCALE/w, SCALE/h);
          w *= r; h *= r;
        }
        canvas.width = w; canvas.height = h;
        if (ctx) {
          ctx.filter = 'contrast(1.1) brightness(1.05)';
          ctx.drawImage(img, 0, 0, w, h);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
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
        { text: `Extract Driver License/ID data using AAMVA 2020 tagging conventions. 
        CRITICAL FIELD MAPPING:
        - Element 1 (Family Name/Surname) -> DCS
        - Element 2 (First Name) -> DAC
        - Element 2 (Middle Name and Suffix like JR, SR, III) -> DAD. Combine middle names and suffixes here.
        - Element 4d (License/DL Number) -> DAQ
        - Element 3 (DOB) -> DBB (MMDDCCYY format)
        - Element 4b (EXP) -> DBA (MMDDCCYY format)
        - Element 4a (ISS) -> DBD (MMDDCCYY format)
        - Element 5 (DD / Document Discriminator / Audit Number) -> DCF. This is a long string of digits.
        - Element 15 (Sex) -> DBC (1=Male, 2=Female)
        - Element 16 (Height) -> DAU (Use F-II format like 5-04 or 5-08)
        - Element 18 (Eyes) -> DAY (3-letter color code like BRO, BLU, GRN)
        - Element 8 (Address) -> DAG (Street), DAI (City), DAJ (State), DAK (Zip)
        - Element 9 (Class) -> DCA
        - Element 9a (Endorsements) -> DCD
        - Element 12 (Restrictions) -> DCB
        - If the text "NOT FOR FEDERAL IDENTIFICATION" is visible, set DDA to 'N'. Otherwise set DDA to 'F'.
        
        Return the result strictly as a flat JSON object with these keys. If a value is "NONE" or missing, return it as "NONE".` }
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
          DCG: { type: Type.STRING },
          DCA: { type: Type.STRING },
          DCD: { type: Type.STRING },
          DCB: { type: Type.STRING },
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
      
      // Sex normalization
      if (key === 'DBC') {
        if (val.includes('M') || val === '1') val = '1';
        else if (val.includes('F') || val === '2') val = '2';
      }
      
      // Date normalization to MMDDCCYY
      if (['DBA', 'DBB', 'DBD'].includes(key)) {
        val = val.replace(/\D/g, '');
      }
      
      cleaned[key] = val;
    });

    return cleaned;
  } catch (e) {
    console.error("OCR Parsing Error:", e);
    return {};
  }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  return JURISDICTIONS.find(j => j.code === (code || "").toUpperCase() && !j.name.includes("Old")) || null;
};
