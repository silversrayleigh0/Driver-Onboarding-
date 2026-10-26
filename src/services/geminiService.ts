import { GoogleGenAI } from "@google/genai";
import { DocumentType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const validateDocument = async (base64Image: string, docType: DocumentType): Promise<{ isValid: boolean; reason?: string }> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the uploaded image and determine if it is a valid ${docType}.
    Check for keywords and visual features associated with this document type in the context of Tamil Nadu, India.
    
    Document Type: ${docType}
    
    Keywords to look for:
    - dl_front/dl_back: "DRIVING", "LICENCE", "DL", "Transport", "RTO", "Non-Transport", "ஓட்டுநர்"
    - rc_book: "REGISTRATION", "CERTIFICATE", "FORM 23", "Chassis", "Engine No", "பதிவு"
    - insurance: "INSURANCE", "POLICY", "Premium", "Valid", "Insured", "காப்பீடு"
    - puc: "POLLUTION", "PUC", "Emission", "Test Date", "மாசு"
    - aadhaar_front/aadhaar_back: "AADHAAR", "आधार", "UID", "Unique Identification", "ஆதார்", "Government of India"
    - vehicle_front/vehicle_side/vehicle_cargo: No keyword check — confirm a vehicle is present in frame.
    
    Return a JSON object with:
    {
      "isValid": boolean,
      "reason": string (if not valid, explain why)
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] || base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      isValid: result.isValid ?? false,
      reason: result.reason
    };
  } catch (error) {
    console.error("Error validating document with Gemini:", error);
    return { isValid: false, reason: "Error processing document validation." };
  }
};
