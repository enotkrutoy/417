
import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Preprocess image for OCR: resize and convert to base64
 */
export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_DIM = 2048; 
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

/**
 * Helper to find jurisdiction by state code (e.g., 'NY', 'CA')
 */
export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  const cleanCode = (code || "").trim().toUpperCase();
  return JURISDICTIONS.find(j => j.code === cleanCode) || null;
};

/**
 * Perform OCR and data extraction using Gemini Vision API
 */
export const scanDLWithGemini = async (
  base64: string, 
  onRetry?: (attempt: number) => void
): Promise<Record<string, string>> => {
  // Use the API key exclusively from environment variables
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Системный API ключ не обнаружен.");
  
  // Initialize AI client inside the function context
  const ai = new GoogleGenAI({ apiKey });
  const maxRetries = 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0 && onRetry) onRetry(attempt);

      // Using gemini-3-flash-preview for vision extraction tasks
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64 } },
              { text: `Analyze the Driver's License or ID card image. 
              Extract all fields according to AAMVA 2020 standard.
              CRITICAL: 
              - Return all dates in YYYYMMDD format for normalization.
              - Map Sex (DBC) to numeric: "1" (Male), "2" (Female), "9" (Unknown).
              - Extract the country identification (DCG) correctly (USA or CAN).
              - Extract the state code (DAJ) as 2 characters.
              - Output JSON only matching the provided schema.` }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              DCS: { type: Type.STRING, description: "Family Name" },
              DAC: { type: Type.STRING, description: "First Name" },
              DAD: { type: Type.STRING, description: "Middle Name" },
              DAQ: { type: Type.STRING, description: "ID Number" },
              DBB: { type: Type.STRING, description: "DOB (YYYYMMDD)" },
              DBA: { type: Type.STRING, description: "Expiry (YYYYMMDD)" },
              DBD: { type: Type.STRING, description: "Issue (YYYYMMDD)" },
              DAJ: { type: Type.STRING, description: "State Code (2 chars)" },
              DAG: { type: Type.STRING, description: "Street Address" },
              DAI: { type: Type.STRING, description: "City" },
              DAK: { type: Type.STRING, description: "Zip Code" },
              DAU: { type: Type.STRING, description: "Height" },
              DAY: { type: Type.STRING, description: "Eye Color" },
              DBC: { type: Type.STRING, description: "Sex" },
              DCG: { type: Type.STRING, description: "Country" }
            }
          }
        },
      });

      // Extract text content directly from response.text property
      const text = response.text;
      if (!text) throw new Error("Received empty response from the vision model.");
      
      return JSON.parse(text);
    } catch (e) {
      console.error(`Extraction attempt ${attempt} failed:`, e);
      if (attempt === maxRetries) throw e;
      // Exponential backoff strategy
      await sleep(1500 * (attempt + 1));
    }
  }
  
  // Ensure the function returns or throws in all execution paths
  throw new Error("Data extraction failed after multiple attempts.");
};
