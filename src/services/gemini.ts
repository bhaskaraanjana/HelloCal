import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FoodItem, CoachPersonality, CoachResponse } from '../types/nutrition';

// Helper to convert Blob to Base64 string
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // Strip out the data URL prefix (e.g., "data:audio/webm;codecs=opus;base64,")
      const base64 = base64data.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
};

const SYSTEM_PROMPT = `
You are HaloCal, a state-of-the-art AI nutritionist. Your task is to analyze natural language food entries (either from a text prompt or from a recorded voice note) and extract structured nutritional data.

You must estimate calories and macronutrients (protein, carbs, and fat in grams) for each food item mentioned. If the portion size is ambiguous, make a smart, realistic estimate based on standard serving sizes and note the confidence as "guess" rather than "high".

You must respond with a JSON object matching this exact TypeScript structure:
{
  "items": [
    {
      "name": "Food Name",
      "quantity": "estimated portion size (e.g. 1 medium, 150g, 2 slices)",
      "calories": 180, // integer
      "protein": 14.5, // float in grams
      "carbs": 22.0,   // float in grams
      "fat": 5.2,      // float in grams
      "confidence": "high" | "guess"
    }
  ],
  "coachingMessage": "Your custom coaching advice here."
}

Rules for the "coachingMessage":
Acknowledge the foods, give a brief, highly personalized review of the meal (e.g. comment on protein content, fiber, nutritional balance, or warning about high sugars), and tailor your tone EXACTLY to the requested personality:
- "encouraging": Warm, highly supportive, congratulates healthy choices, emphasizes long-term consistency, gentle.
- "strict": No-excuses trainer mode. Pushes for high protein, calls out high sugar/saturated fat directly, direct and brief.
- "analytical": Scientific, objective, mentions glycemic impact, vitamins, fiber, or exact metabolic details. No fluff.
- "chill": Extremely relaxed, casual buddy tone. "Hey, looks delicious, keep doing your thing, no worries!"
`;

export const gemini = {
  async parseVoice(blob: Blob, apiKey: string, personality: CoachPersonality): Promise<CoachResponse> {
    if (!apiKey) {
      throw new Error('Gemini API key is required to use Voice Supermode.');
    }

    try {
      const base64Audio = await blobToBase64(blob);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const promptText = `
Analyze the uploaded audio recording containing someone stating what they ate. Extract the foods and calculate nutrition.
The requested coaching personality is: "${personality}".
      `;

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Audio,
            mimeType: blob.type || 'audio/webm'
          }
        },
        {
          text: `${SYSTEM_PROMPT}\n\n${promptText}`
        }
      ]);

      const responseText = result.response.text();
      const parsedData = JSON.parse(responseText) as CoachResponse;

      // Validate structure slightly to avoid errors
      if (!parsedData.items || !Array.isArray(parsedData.items)) {
        throw new Error('Gemini response did not contain a valid items array.');
      }

      return parsedData;
    } catch (error) {
      console.error('Error parsing voice with Gemini:', error);
      throw error;
    }
  },

  async parseText(text: string, apiKey: string, personality: CoachPersonality): Promise<CoachResponse> {
    if (!apiKey) {
      throw new Error('Gemini API key is required to use Smart AI Text parsing.');
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const promptText = `
Analyze the following text input: "${text}".
The requested coaching personality is: "${personality}".
      `;

      const result = await model.generateContent([
        {
          text: `${SYSTEM_PROMPT}\n\n${promptText}`
        }
      ]);

      const responseText = result.response.text();
      const parsedData = JSON.parse(responseText) as CoachResponse;

      if (!parsedData.items || !Array.isArray(parsedData.items)) {
        throw new Error('Gemini response did not contain a valid items array.');
      }

      return parsedData;
    } catch (error) {
      console.error('Error parsing text with Gemini:', error);
      throw error;
    }
  },

  async correctVoice(currentItems: Omit<FoodItem, 'id'>[], blob: Blob, apiKey: string, personality: CoachPersonality): Promise<CoachResponse> {
    if (!apiKey) {
      throw new Error('Gemini API key is required.');
    }

    try {
      const base64Audio = await blobToBase64(blob);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const promptText = `
The staged items currently being logged are:
${JSON.stringify(currentItems, null, 2)}

The user spoke this correction, subtraction, or addition in the uploaded audio recording. Analyze it and output the updated full JSON list of items.
Requested personality: "${personality}".
      `;

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Audio,
            mimeType: blob.type || 'audio/webm'
          }
        },
        {
          text: `${SYSTEM_PROMPT}\n\n${promptText}`
        }
      ]);

      const responseText = result.response.text();
      const parsedData = JSON.parse(responseText) as CoachResponse;

      if (!parsedData.items || !Array.isArray(parsedData.items)) {
        throw new Error('Gemini response did not contain a valid items array.');
      }

      return parsedData;
    } catch (error) {
      console.error('Error applying voice correction with Gemini:', error);
      throw error;
    }
  },

  async correctText(currentItems: Omit<FoodItem, 'id'>[], text: string, apiKey: string, personality: CoachPersonality): Promise<CoachResponse> {
    if (!apiKey) {
      throw new Error('Gemini API key is required.');
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const promptText = `
The staged items currently being logged are:
${JSON.stringify(currentItems, null, 2)}

The user wrote this correction: "${text}". Analyze it and output the updated full JSON list of items.
Requested personality: "${personality}".
      `;

      const result = await model.generateContent([
        {
          text: `${SYSTEM_PROMPT}\n\n${promptText}`
        }
      ]);

      const responseText = result.response.text();
      const parsedData = JSON.parse(responseText) as CoachResponse;

      if (!parsedData.items || !Array.isArray(parsedData.items)) {
        throw new Error('Gemini response did not contain a valid items array.');
      }

      return parsedData;
    } catch (error) {
      console.error('Error applying text correction with Gemini:', error);
      throw error;
    }
  }
};
