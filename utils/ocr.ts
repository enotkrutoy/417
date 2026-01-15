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
        { text: `Extract Driver License/ID data from this image (can be Front or Back). Use AAMVA 2020 tags.
        
        CRITICAL MAPPING RULES:
        - DCS: Family Name / Last Name
        - DAC: First Name
        - DAD: Middle Names AND Suffixes (like JR, SR, III) - combine them here.
        - DAQ: License Number / ID Number
        - DBB: Date of Birth (Format: MMDDCCYY)
        - DBA: Expiration Date (Format: MMDDCCYY)
        - DBD: Issue Date (Format: MMDDCCYY)
        - DCF: Document Discriminator / Audit Number / DD number (Look for long string of digits, usually on bottom right or near barcode)
        - DCA: Class (e.g., A, B, C, D, M)
        - DCB: Restrictions (e.g., NONE, or codes like A, B, E/64)
        - DCD: Endorsements (e.g., NONE, or codes like P, X)
        - DAG, DAI, DAJ, DAK: Address components (Street, City, State, Zip)
        - DBC: Sex (1 for Male, 2 for Female)
        - DAU: Height (Use feet-inches format like 5-08 if seen)
        
        COMPLIANCE LOGIC (DDA):
        - If you see "NOT FOR FEDERAL IDENTIFICATION", "NON-COMPLIANT", or disclaimer text like "does not establish eligibility for employment/voting", set DDA to 'N'.
        - Otherwise, set DDA to 'F'.
        
        Return the result as a flat JSON object with these keys. If a field is not found or is "NONE", use "NONE".` }
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
      
      // Normalize dates to MMDDCCYY if they contain slashes
      if (['DBA', 'DBB', 'DBD'].includes(key)) {
        val = val.replace(/\D/g, '');
      }
      
      // Normalize sex
      if (key === 'DBC') {
        if (val.includes('M') || val === '1') val = '1';
        else if (val.includes('F') || val === '2') val = '2';
      }
      
      cleaned[key] = val;
    });

    return cleaned;
  } catch (e) {
    console.error("OCR Parse Error:", e);
    return {};
  }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  return JURISDICTIONS.find(j => j.code === (code || "").toUpperCase() && !j.name.includes("Old")) || null;
};