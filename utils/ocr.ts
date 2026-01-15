import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

/**
 * Preprocesses image to Base64 for the API.
 * 
 * BEST PRACTICES FOR OCR/LLM INPUT:
 * 1. Resolution: Increased to 2048px (1024px is often too small for fine print on DLs).
 * 2. Contrast: Boosted to separate text from security background patterns.
 * 3. Brightness: Slight boost to normalize lighting.
 * 4. Compression: High quality JPEG (0.92) to prevent artifacts on text edges.
 */
export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Target ~4MP for optimal balance of detail vs token usage/upload speed
        const MAX_DIMENSION = 2048; 
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio preserving dimensions
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
            // Fallback if context fails
            resolve((event.target?.result as string).split(',')[1]);
            return;
        }
        
        // 1. Fill white background (handles transparent PNGs nicely)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // 2. Apply Filters to enhance Text Legibility
        // contrast(1.2): Makes dark text darker and light backgrounds lighter.
        // brightness(1.05): Compenses for potentially dark indoor photos.
        // saturate(1.1): Helps preserve color cues (like Red headers) while boosting signal.
        ctx.filter = 'contrast(1.2) brightness(1.05) saturate(1.1)';

        // 3. Draw image with high-quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // 4. Export as High Quality JPEG
        // 0.92 reduces artifacting around text edges compared to standard 0.8
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
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
  
  // Use 'gemini-2.5-flash' as requested
  const modelId = "gemini-2.5-flash";

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