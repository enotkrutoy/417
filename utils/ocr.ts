import { GoogleGenAI, Type } from "@google/genai";
import { DLFormData, Jurisdiction } from '../types';
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
export const scanDLWithGemini = async (base64Image: string): Promise<Partial<DLFormData>> => {
  // NOTE: process.env.API_KEY is assumed to be injected by the build system/environment
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Updated to use the latest Flash 2.5 model for improved speed and accuracy
  const modelId = "gemini-2.5-flash-latest";

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
    const data = JSON.parse(text);
    return data;
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