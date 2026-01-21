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
        const MAX_DIM = 1600; // Increased resolution for better tag detection
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

export const scanDLWithGemini = async (base64: string, customKey?: string): Promise<Record<string, string>> => {
  // Use user-provided key or fall back to system environment key as per guidelines
  const apiKey = customKey || process.env.API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: `Extract AAMVA 2020 Data Tags from this Identity Document. 
        CRITICAL: Search for 'Audit Number', 'DD', or 'Discriminator' for the DCF tag. 
        If a field is missing, return "unavl". If it's a person's name part they likely don't have, use "NONE".
        Return strictly JSON matching this schema.` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          DCS: { type: Type.STRING, description: "Last Name" },
          DAC: { type: Type.STRING, description: "First Name" },
          DAD: { type: Type.STRING, description: "Middle Name or NONE" },
          DCU: { type: Type.STRING, description: "Suffix or NONE" },
          DAQ: { type: Type.STRING, description: "ID/License Number" },
          DCF: { type: Type.STRING, description: "Document Discriminator / Audit Number" },
          DBB: { type: Type.STRING, description: "DOB (MMDDYYYY or YYYYMMDD)" },
          DBA: { type: Type.STRING, description: "Expiry Date" },
          DBD: { type: Type.STRING, description: "Issue Date" },
          DAJ: { type: Type.STRING, description: "State Code" },
          DCG: { type: Type.STRING, description: "Country (USA/CAN)" },
          DDA: { type: Type.STRING, description: "Compliance F/N" },
          DDB: { type: Type.STRING, description: "Revision Date" },
          DDK: { type: Type.STRING, description: "Organ Donor 1/0" },
          DAU: { type: Type.STRING, description: "Height" },
          DAW: { type: Type.STRING, description: "Weight" },
          DAY: { type: Type.STRING, description: "Eye Color (3-char)" },
          DAZ: { type: Type.STRING, description: "Hair Color (3-char)" },
          DAG: { type: Type.STRING, description: "Address line 1" },
          DAI: { type: Type.STRING, description: "City" },
          DAK: { type: Type.STRING, description: "Zip/Postal Code" }
        }
      }
    }
  });

  try {
    const raw = JSON.parse(response.text || "{}");
    const cleaned: Record<string, string> = {};
    Object.keys(raw).forEach(key => {
      let val = String(raw[key] || "").toUpperCase().trim();
      if (['DBA', 'DBB', 'DBD', 'DAW', 'DDB'].includes(key)) {
        val = val.replace(/\D/g, '');
      }
      cleaned[key] = val === "UNAVL" ? "" : val;
    });
    return cleaned;
  } catch (e) { 
    throw new Error("Neural Engine failed to de-serialize matrix. Check image clarity."); 
  }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  return JURISDICTIONS.find(j => j.code === (code || "").toUpperCase()) || null;
};