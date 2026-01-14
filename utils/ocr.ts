import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

/**
 * Preprocesses image to Base64 for the API.
 * Compresses large images to save bandwidth while maintaining readability.
 */
export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Max dimension 1024px is usually enough for DL OCR
        const maxDim = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        } else if (height > width && height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            // Fallback to original if context fails
            resolve((event.target?.result as string).split(',')[1]);
            return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        // Return Base64 string without data prefix
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Uses Google Gemini Vision (Flash) to extract structured DL data.
 */
export const scanDLWithGemini = async (base64Image: string, apiKey: string): Promise<Record<string, string>> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please provide a valid Gemini API Key.");
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Use 'gemini-2.0-flash' as the standard stable multimodal model.
  // 'gemini-2.0-flash-exp' is deprecated and returns 404.
  const modelId = "gemini-2.0-flash";

  const response = await ai.models.generateContent({
    model: modelId,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image
          }
        },
        {
          text: `Analyze this US/Canada Driver's License image. Extract the data into the specified JSON structure.
                 Rules:
                 1. Dates: Format STRICTLY as MMDDYYYY (e.g. 09141976).
                 2. Sex: Return '1' for Male, '2' for Female.
                 3. Height: Convert to total inches, 3 digits, followed by ' in'. Example: 5'02" -> '062 in'. 
                 4. State: Use 2-letter abbreviation (e.g. TX, CA).
                 5. Eye/Hair: Use 3-letter standard codes (BRO, BLU, BLK, etc.).
                 6. If a field is not visible, use empty string.
                 7. Restrictions/Endorsements: Use 'NONE' if not found.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          DCS: { type: Type.STRING, description: "Last Name / Surname" },
          DAC: { type: Type.STRING, description: "First Name" },
          DAD: { type: Type.STRING, description: "Middle Name (or empty)" },
          DAQ: { type: Type.STRING, description: "License Number" },
          DBB: { type: Type.STRING, description: "Date of Birth (MMDDYYYY)" },
          DBA: { type: Type.STRING, description: "Expiration Date (MMDDYYYY)" },
          DBD: { type: Type.STRING, description: "Issue Date (MMDDYYYY)" },
          DAG: { type: Type.STRING, description: "Street Address" },
          DAI: { type: Type.STRING, description: "City" },
          DAJ: { type: Type.STRING, description: "State Code (2 letters)" },
          DAK: { type: Type.STRING, description: "Zip Code (5 or 9 digits only)" },
          DBC: { type: Type.STRING, description: "Sex (1 or 2)" },
          DAU: { type: Type.STRING, description: "Height (e.g., '062 in')" },
          DAW: { type: Type.STRING, description: "Weight (lbs)" },
          DAY: { type: Type.STRING, description: "Eye Color (3 letters)" },
          DAZ: { type: Type.STRING, description: "Hair Color (3 letters)" },
          DCA: { type: Type.STRING, description: "Class" },
          DCB: { type: Type.STRING, description: "Restrictions" },
          DCD: { type: Type.STRING, description: "Endorsements" },
          DCF: { type: Type.STRING, description: "Document Discriminator" },
          DCG: { type: Type.STRING, description: "Country (USA or CAN)" }
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
    
    // Ensure we only return string values to satisfy strict types in App.tsx
    // DLFormData has an index signature [key: string]: string, so no undefined allowed.
    Object.keys(rawData).forEach(key => {
        const val = rawData[key];
        if (typeof val === 'string') {
            sanitized[key] = val;
        } else if (typeof val === 'number') {
            sanitized[key] = String(val);
        }
    });
    
    return sanitized;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return {};
  }
};

/**
 * Helper to match State Code to Jurisdiction object
 */
export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
    if (!code) return null;
    const upper = code.toUpperCase();
    return JURISDICTIONS.find(j => j.code === upper && !j.name.includes("Old")) || null;
}