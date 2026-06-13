import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FoodItem, WorkoutLog, CoachPersonality, CoachResponse, UserGoals, AppSettings, CommandResponse } from '../types/nutrition';
import {
  extractJSON,
  validateCoachResponse,
  validateCommandResponse,
  sanitizePersonality,
  withRetry,
} from './validation';

const MODEL_NAME = 'gemini-2.5-flash';

// Helper to convert Blob to Base64 string
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const base64 = base64data.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
};

const SYSTEM_PROMPT = `
You are HelloCal, an advanced AI nutritionist and fitness coach. Your task is to analyze natural language logs (from text, voice, or food photo scans) and extract structured nutritional or workout data.

You must handle three types of entries, which you will classify via the "type" field:
1. "food": If the user is logging things they ate.
2. "workout": If the user is logging physical exercises or activities.
3. "mixed": If the user is logging both meals and physical exercises in a single input.

For Food Logging:
You must estimate calories and macronutrients (protein, carbs, and fat in grams), as well as key micronutrients (sugar, addedSugar, and fiber in grams; sodium in milligrams) for each food item mentioned. If the portion size is ambiguous, make a smart, realistic estimate based on standard USDA serving sizes and note confidence as "guess" rather than "high".
If sugar, addedSugar, fiber, or sodium are not present or negligible, set them to 0.
"sugar" is TOTAL sugar; "addedSugar" is ONLY manufacturer/recipe-added sugar (table sugar, syrups, sweeteners). Naturally occurring sugar in whole fruit, plain milk, or plain yogurt is NOT added sugar — set addedSugar to 0 for those. addedSugar must never exceed total sugar.
Sanity-check every estimate: calories should roughly equal protein*4 + carbs*4 + fat*9 (within ~20%). Never output negative numbers.

For Workout Logging:
Identify the activity and duration in minutes. Estimate calories burned in kcal using standard MET (Metabolic Equivalent) values, assuming a 75 kg (165 lb) adult unless the user states otherwise. Use the formula: caloriesBurned = MET * 75 * (duration_minutes / 60). Reference METs: walking 3.5, brisk walking 4.3, running (6 mph) 9.8, cycling (moderate) 7.5, swimming 8.0, weightlifting 4.0, yoga 2.5, HIIT 9.0, elliptical 5.0, hiking 6.0. If the user explicitly gives calories burned, use their number.

You must respond with ONLY a JSON object (no markdown, no prose) matching this exact TypeScript structure:
{
  "type": "food" | "workout" | "mixed",
  "items": [ // only include for "food" or "mixed" types
    {
      "name": "Food Name",
      "quantity": "estimated portion size (e.g. 1 medium, 150g, 2 slices)",
      "calories": 180, // integer
      "protein": 14.5, // float in grams
      "carbs": 22.0,   // float in grams
      "fat": 5.2,      // float in grams
      "sugar": 12.0,   // float in grams
      "addedSugar": 4.5, // float in grams
      "fiber": 3.0,    // float in grams
      "sodium": 120,   // integer in milligrams
      "confidence": "high" | "guess"
    }
  ],
  "workout": { // only include for "workout" or "mixed" types
    "activity": "Activity Name (e.g. Running, Weightlifting, Yoga)",
    "duration": 45, // integer in minutes
    "caloriesBurned": 350, // integer in kcal
    "notes": "Estimated active burn for a 45 min session" // brief exercise summary note
  },
  "coachingMessage": "Your custom coaching advice here."
}

Rules for the "coachingMessage":
Acknowledge the foods and/or exercises logged, comment on protein, fiber, or added sugar, celebrate active workouts, and tailor your tone EXACTLY to the requested personality:
- "encouraging": Warm, highly supportive, congratulates healthy choices and active workouts, gentle.
- "strict": No-excuses trainer mode. Pushes for high protein, warns directly about high added sugar, calls out exercise slacking or praises hard burn briefly.
- "analytical": Scientific, objective, mentions glycemic impact, MET value for exercise, fiber, sodium, or exact metabolic details. No fluff.
- "chill": Extremely relaxed, casual buddy tone. "Hey, awesome job on that workout, keep doing your thing, looks delicious!"
`;

const APP_COMMAND_PROMPT = `
You are the AI Command Center of HelloCal. The user has clicked a dashboard card or triggered the dynamic customize button, requesting a custom UI modification, a theme change, an active widget toggle, or a numeric target goal change (by voice or text).
Your task is to analyze their request, review their current goals and settings, and determine the exact updates required.

Available Themes:
- "obsidian" (Default dark, obsidian-black glassmorphic styling)
- "cyberpunk" (Vibrant neon pink, magenta, and dark purple aura theme)
- "ocean" (Deep maritime blue, sky blue, and glowing azure theme)
- "emerald" (Lush forest green, glowing emerald details, and mint accents)

Available Progress Counters within Cards to Show/Hide:
- macronutrients: "protein", "carbs", "fat" (under visibleMacros)
- micronutrients: "addedSugar", "fiber", "sodium" (under visibleMicros)

Available Cards (Widgets) to Show/Hide (under visibleWidgets):
- "calorieHalo" (The daily progress ring card)
- "macros" (Macronutrient target levels card)
- "micros" (Micronutrient dashboard target card)
- "workouts" (Logged exercises list widget)
- "mealSlots" (🍳 B, 🍱 L, 🥗 D counts summary)
- "goalCompletion" (Percentage target progress card)

Numeric Targets you can update (inside updatedGoals):
- calories (kcal), protein (g), carbs (g), fat (g), addedSugar (g), fiber (g), sodium (mg).

You MUST respond with ONLY a JSON object (no markdown, no prose) matching this exact structure:
{
  "updatedGoals": {
    // Include ONLY targets that were modified by this command. E.g. {"protein": 150} if the user said "make protein goal 150g". Do not include unmodified fields.
  },
  "updatedSettings": {
    // Include ONLY settings that were modified by this command.
    "theme": "obsidian" | "cyberpunk" | "ocean" | "emerald",
    "visibleMacros": {
      "protein": true/false,
      "carbs": true/false,
      "fat": true/false
    },
    "visibleMicros": {
      "addedSugar": true/false,
      "fiber": true/false,
      "sodium": true/false
    },
    "visibleWidgets": {
      "calorieHalo": true/false,
      "macros": true/false,
      "micros": true/false,
      "workouts": true/false,
      "mealSlots": true/false,
      "goalCompletion": true/false
    }
  },
  "aiResponse": "A friendly, extremely concise confirmation message detailing exactly what you changed (e.g. 'Got it! I've activated Cyberpunk Neon mode. Enjoy the vibrant pink glows!'). Keep it natural, confident, and tailored."
}

Interpretations:
- If they say "hide fats counter", set visibleMacros.fat to false.
- If they say "add sodium counter to macros", set visibleMicros.sodium to true (since sodium is tracked as a micronutrient) and explain it in the aiResponse.
- If they say "switch to green layout", set theme to "emerald".
- If they say "show all cards", set all booleans inside visibleWidgets to true.
- If they say "hide stats card", set visibleWidgets.mealSlots and/or goalCompletion to false.
`;

type Part = { text: string } | { inlineData: { data: string; mimeType: string } };

/** Build a model + run generateContent with retry/backoff, returning the raw text response. */
async function runModel(apiKey: string, parts: Part[]): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: 'application/json' },
  });

  return withRetry(async () => {
    const result = await model.generateContent(parts as any);
    return result.response.text();
  });
}

/** A per-call instruction that overrides the prompt's default 75 kg assumption. */
const weightNote = (weightKg?: number): string =>
  weightKg && weightKg > 0
    ? ` The user weighs ${Math.round(weightKg)} kg; use THIS weight for MET-based workout calorie burn (caloriesBurned = MET * ${Math.round(weightKg)} * minutes/60) unless they explicitly state calories.`
    : '';

const audioPart = async (blob: Blob): Promise<Part> => ({
  inlineData: { data: await blobToBase64(blob), mimeType: blob.type || 'audio/webm' },
});

const imagePart = async (blob: Blob): Promise<Part> => ({
  inlineData: { data: await blobToBase64(blob), mimeType: blob.type || 'image/jpeg' },
});

export const gemini = {
  async parseVoice(blob: Blob, apiKey: string, personality: CoachPersonality, weightKg?: number): Promise<CoachResponse> {
    if (!apiKey) throw new Error('Gemini API key is required to use Voice Supermode.');

    const promptText = `Analyze the uploaded audio recording. It may contain a food log or workout log or both. Extract metrics accordingly.${weightNote(weightKg)}\nThe requested coaching personality is: "${sanitizePersonality(personality)}".`;

    const text = await runModel(apiKey, [
      await audioPart(blob),
      { text: `${SYSTEM_PROMPT}\n\n${promptText}` },
    ]);
    return validateCoachResponse(extractJSON(text));
  },

  async parseText(text: string, apiKey: string, personality: CoachPersonality, weightKg?: number): Promise<CoachResponse> {
    if (!apiKey) throw new Error('Gemini API key is required to use Smart AI Text parsing.');

    const promptText = `Analyze the following text input: "${text}". It may contain a food log or workout log or both. Extract metrics accordingly.${weightNote(weightKg)}\nThe requested coaching personality is: "${sanitizePersonality(personality)}".`;

    const response = await runModel(apiKey, [{ text: `${SYSTEM_PROMPT}\n\n${promptText}` }]);
    return validateCoachResponse(extractJSON(response));
  },

  async parseImage(blob: Blob, apiKey: string, personality: CoachPersonality, weightKg?: number): Promise<CoachResponse> {
    if (!apiKey) throw new Error('Gemini API key is required to use Visual Photo Scanning.');

    const promptText = `Analyze the uploaded image. It contains a meal, ingredients, or a nutrition facts label. Identify what it is, estimate portions, and calculate the nutritional metrics.${weightNote(weightKg)}\nThe requested coaching personality is: "${sanitizePersonality(personality)}".`;

    const text = await runModel(apiKey, [
      await imagePart(blob),
      { text: `${SYSTEM_PROMPT}\n\n${promptText}` },
    ]);
    return validateCoachResponse(extractJSON(text));
  },

  async correctVoice(
    currentItems: Omit<FoodItem, 'id'>[],
    currentWorkout: Omit<WorkoutLog, 'id'> | null,
    blob: Blob,
    apiKey: string,
    personality: CoachPersonality,
    weightKg?: number
  ): Promise<CoachResponse> {
    if (!apiKey) throw new Error('Gemini API key is required.');

    const promptText = `
The staged data currently has:
- Food Items: ${JSON.stringify(currentItems, null, 2)}
- Workout: ${currentWorkout ? JSON.stringify(currentWorkout, null, 2) : 'None'}

The user spoke this correction, subtraction, or addition in the uploaded audio recording. Analyze it and output the updated full JSON containing type, items, and workout.${weightNote(weightKg)}
Requested personality: "${sanitizePersonality(personality)}".`;

    const text = await runModel(apiKey, [
      await audioPart(blob),
      { text: `${SYSTEM_PROMPT}\n\n${promptText}` },
    ]);
    return validateCoachResponse(extractJSON(text));
  },

  async correctText(
    currentItems: Omit<FoodItem, 'id'>[],
    currentWorkout: Omit<WorkoutLog, 'id'> | null,
    text: string,
    apiKey: string,
    personality: CoachPersonality,
    weightKg?: number
  ): Promise<CoachResponse> {
    if (!apiKey) throw new Error('Gemini API key is required.');

    const promptText = `
The staged data currently has:
- Food Items: ${JSON.stringify(currentItems, null, 2)}
- Workout: ${currentWorkout ? JSON.stringify(currentWorkout, null, 2) : 'None'}

The user wrote this correction: "${text}". Analyze it and output the updated full JSON containing type, items, and workout.${weightNote(weightKg)}
Requested personality: "${sanitizePersonality(personality)}".`;

    const response = await runModel(apiKey, [{ text: `${SYSTEM_PROMPT}\n\n${promptText}` }]);
    return validateCoachResponse(extractJSON(response));
  },

  async executeAppCommand(
    text: string,
    voiceBlob: Blob | null,
    currentGoals: UserGoals,
    currentSettings: AppSettings,
    apiKey: string
  ): Promise<CommandResponse> {
    if (!apiKey) throw new Error('Gemini API Key is required to run the AI Dashboard Customizer.');

    const promptText = `
The current user target goals: ${JSON.stringify(currentGoals, null, 2)}
The current dashboard visual configurations: ${JSON.stringify(currentSettings, null, 2)}

Interpret the user's design command and output the updated layout details.`;

    const parts: Part[] = [];
    if (voiceBlob) {
      parts.push(await audioPart(voiceBlob));
    }
    const queryText = text ? `User command text: "${text}"` : `User command voice audio.`;
    parts.push({ text: `${APP_COMMAND_PROMPT}\n\n${promptText}\n\n${queryText}` });

    const response = await runModel(apiKey, parts);
    return validateCommandResponse(extractJSON(response));
  },
};
