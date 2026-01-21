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
        canvas.width = w; canvas.width = w; canvas.height = h;
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
        { text: `Extract AAMVA 2020 tags from the Driver's License or ID card image.
        Return strictly JSON with these keys:
        - DCS: Last Name
        - DAC: First Name
        - DAD: Middle Name
        - DCU: Name Suffix (JR, SR, III, etc.)
        - DAQ: License Number
        - DCF: Document Discriminator (Extremely Important! Search for labels like 'Audit', 'Audit #', 'DD', or 'Document Discriminator'. Often located in a corner or the bottom edge)
        - DBB: Date of Birth (numeric only)
        - DBA: Expiration Date (numeric only)
        - DBD: Issue Date (numeric only)
        - DAJ: 2-character State/Province Code
        - DCG: Country Code (USA or CAN)
        - DDA: Compliance (F for Star/RealID, N for None)
        - DDB: Card Revision/Design Date (Look for small dates near edge or 'Rev')
        - DDK: Organ Donor (1 for Yes, 0 for No)
        - DAU: Height
        - DAW: Weight
        - DAY: Eye Color
        - DAZ: Hair Color
        - DAG: Street Address
        - DAI: City
        - DAK: ZIP/Postal Code` }
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
          DDB: { type: Type.STRING },
          DDK: { type: Type.STRING },
          DAG: { type: Type.STRING },
          DAI: { type: Type.STRING },
          DAK: { type: Type.STRING }
        }
      }
    }
  });

  try {
    const raw = JSON.parse(response.text || "{}");
    const cleaned: Record<string, string> = {};
    Object.keys(raw).forEach(key => {
      let val = String(raw[key] || "").toUpperCase().trim();
      // Only clean numeric fields
      if (['DBA', 'DBB', 'DBD', 'DAW', 'DDB'].includes(key)) {
        val = val.replace(/\D/g, '');
      }
      cleaned[key] = val;
    });
    return cleaned;
  } catch (e) { 
    throw new Error("Failed to parse AI response. Ensure the image is clear."); 
  }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  return JURISDICTIONS.find(j => j.code === (code || "").toUpperCase()) || null;
};