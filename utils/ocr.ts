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
        const SCALE = 1024; // Lowered from 1600 for better reliability
        let w = img.width, h = img.height;
        if (w > SCALE || h > SCALE) {
          const r = Math.min(SCALE/w, SCALE/h);
          w *= r; h *= r;
        }
        canvas.width = w; canvas.height = h;
        if (ctx) {
          ctx.filter = 'contrast(1.1) brightness(1.0)';
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
        { text: `Analyze Driver's License image. Extract into AAMVA tags:
        - DCS: Last Name
        - DAC: First Name
        - DAD: Middle/Suffix
        - DAQ: ID Number (EXACT)
        - DBB: DOB (MMDDCCYY)
        - DBA: Expiry (MMDDCCYY)
        - DBD: Issue (MMDDCCYY)
        - DCF: DOCUMENT DISCRIMINATOR / AUDIT NUMBER (Usually labeled 'DD', 'Audit', or long numeric string at bottom)
        - DAU: Height in Ft-In format (e.g., 5-04)
        - DBC: Sex (1=M, 2=F)
        - DAY: Eye Color (3-letter: BRO, BLU, etc.)
        - DAG, DAI, DAJ, DAK: Full Address
        
        Return JSON object.` }
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
          DCF: { type: Type.STRING }
        }
      }
    }
  });

  try {
    let jsonText = response.text || "{}";
    // Sanitize response text: remove markdown code blocks if they exist
    if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    
    const raw = JSON.parse(jsonText);
    const cleaned: Record<string, string> = {};
    Object.keys(raw).forEach(key => {
      let val = String(raw[key] || "").toUpperCase().trim();
      // Only keep digits for dates
      if (['DBA', 'DBB', 'DBD'].includes(key)) val = val.replace(/\D/g, '');
      cleaned[key] = val;
    });
    return cleaned;
  } catch (e) {
    console.error("Gemini Response Processing Error:", e);
    throw new Error("Failed to parse AI response. Ensure your image is clear and try again.");
  }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  return JURISDICTIONS.find(j => j.code === (code || "").toUpperCase() && !j.name.includes("Old")) || null;
};