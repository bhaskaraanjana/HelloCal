import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FoodItem, WorkoutLog, CoachPersonality, CoachResponse, Recipe } from '../types/nutrition';
import type { AiCredentials } from './aiRuntime';
import { assertAiReady, toAiCredentials, type AiAccess } from './aiRuntime';
import { runHostedModel } from './geminiProxy';
import {
  extractJSON,
  validateCoachResponse,
  sanitizePersonality,
  withRetry,
} from './validation';
import { sanitizeRecipes } from './sanitize';

const MICRO_UNITS = ['g', 'mg', 'mcg', 'IU'];
const MICRO_COLORS = ['var(--accent-purple)', 'var(--accent-teal)', 'var(--accent-amber)', 'var(--accent-rose)', 'var(--accent-blue)'];

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
You are HelloCal, an advanced AI nutritionist. Your task is to analyze natural language logs (from text, voice, or food photo scans) and extract structured nutritional data for food the user ate.

This app logs food calories only. If the user mentions exercise or workouts, ignore that and extract only food items if any are present. Always set "type" to "food" and never include a "workout" field.

For Food Logging:
You must estimate calories and macronutrients (protein, carbs, and fat in grams), as well as micronutrients: total sugar, added sugar, and fiber in grams; sodium, iron, calcium, potassium, cholesterol, vitamin C, zinc, and magnesium in milligrams; vitamin A, vitamin D, vitamin B12, and folate in micrograms.
In addition, you should estimate any other notable micronutrients, vitamins, or minerals present in the food (like copper, selenium, iodine, vitamin K, biotin, choline, manganese, etc.) and list them inside a nested 'micros' object. Map the lowercase alnum name (e.g. "copper", "selenium", "vitamink") to its numeric value in standard units (mcg for iodine/selenium/vitaminK/biotin/chromium, mg for copper/manganese/pantothenicacid/niacin/riboflavin/thiamin). For fish, seafood, walnuts, flax, chia, and seed oils estimate "omega3" in grams (total omega-3 fatty acids). For vegetable oils, nuts, and seeds estimate "omega6" in grams (linoleic acid / omega-6).
If the portion size is ambiguous, make a smart, realistic estimate based on standard USDA serving sizes and note confidence as "guess" rather than "high".
If any micronutrient is not present or negligible, set it to 0.
"sugar" is TOTAL sugar; "addedSugar" is ONLY manufacturer/recipe-added sugar (table sugar, syrups, sweeteners). Naturally occurring sugar in whole fruit, plain milk, or plain yogurt is NOT added sugar — set addedSugar to 0 for those. addedSugar must never exceed total sugar.
Sanity-check every estimate: calories should roughly equal protein*4 + carbs*4 + fat*9 (within ~20%). Never output negative numbers.

You must respond with ONLY a JSON object (no markdown, no prose) matching this exact TypeScript structure:
{
  "type": "food",
  "items": [
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
      "iron": 1.2,     // float in milligrams
      "calcium": 45.0, // float in milligrams
      "potassium": 240.0, // float in milligrams
      "cholesterol": 0.0, // float in milligrams
      "saturatedFat": 1.5, // float in grams
      "transFat": 0.0,    // float in grams
      "vitaminA": 45.0,   // float in micrograms (mcg)
      "vitaminC": 8.0,    // float in milligrams (mg)
      "vitaminD": 0.5,    // float in micrograms (mcg)
      "vitaminB12": 0.1,  // float in micrograms (mcg)
      "zinc": 0.8,        // float in milligrams (mg)
      "magnesium": 25.0,  // float in milligrams (mg)
      "folate": 15.0,     // float in micrograms (mcg)
      "micros": {         // object containing any other present micronutrients/vitamins not listed above (lowercase keys)
        "selenium": 12.5, // float in micrograms (mcg)
        "copper": 0.2,    // float in milligrams (mg)
        "vitamink": 15.0, // float in micrograms (mcg)
        "omega3": 0.8,    // float in grams (total omega-3)
        "omega6": 2.1     // float in grams (omega-6)
      },
      "confidence": "high" | "guess"
    }
  ],
  "coachingMessage": "Your custom coaching advice here."
}

Rules for the "coachingMessage":
Acknowledge the foods logged, comment on protein, fiber, or added sugar, and tailor your tone EXACTLY to the requested personality:
- "encouraging": Warm, highly supportive, congratulates healthy choices, gentle.
- "strict": No-excuses trainer mode. Pushes for high protein, warns directly about high added sugar.
- "analytical": Scientific, objective, mentions glycemic impact, fiber, sodium, or exact metabolic details. No fluff.
- "chill": Extremely relaxed, casual buddy tone. "Hey, looks delicious — nice protein on that one!"
`;

type Part = { text: string } | { inlineData: { data: string; mimeType: string } };

/** Build a model + run generateContent with retry/backoff, returning the raw text response. */
async function runModel(creds: AiCredentials, parts: Part[]): Promise<string> {
  if (creds.mode === 'hosted') {
    return withRetry(() => runHostedModel(parts, MODEL_NAME));
  }

  if (!creds.apiKey) throw new Error('Gemini API key is required.');

  const genAI = new GoogleGenerativeAI(creds.apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: 'application/json' },
  });

  return withRetry(async () => {
    const result = await model.generateContent(parts as any);
    const resp = result.response;
    const blockReason = resp?.promptFeedback?.blockReason;
    const finishReason = resp?.candidates?.[0]?.finishReason;
    if (blockReason || finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
      throw new Error("The AI couldn't process that input. Try rephrasing, or use a clearer photo.");
    }
    try {
      return resp.text();
    } catch {
      throw new Error('The AI returned an empty response. Please try again.');
    }
  });
}

/** Resolve credentials from AiAccess (convenience for components). */
function credsFrom(access: AiAccess): AiCredentials {
  return toAiCredentials(access);
}

/** @deprecated weight is unused — app logs food calories only */
const weightNote = (_weightKg?: number): string => '';

const audioPart = async (blob: Blob): Promise<Part> => ({
  inlineData: { data: await blobToBase64(blob), mimeType: blob.type || 'audio/webm' },
});

const imagePart = async (blob: Blob): Promise<Part> => ({
  inlineData: { data: await blobToBase64(blob), mimeType: blob.type || 'image/jpeg' },
});

export const gemini = {
  async parseVoice(blob: Blob, access: AiAccess, personality: CoachPersonality, weightKg?: number): Promise<CoachResponse> {
    assertAiReady(access, 'Voice Supermode');

    const promptText = `Analyze the uploaded audio recording. Extract food the user ate and nutritional metrics.${weightNote(weightKg)}\nThe requested coaching personality is: "${sanitizePersonality(personality)}".`;

    const text = await runModel(credsFrom(access), [
      await audioPart(blob),
      { text: `${SYSTEM_PROMPT}\n\n${promptText}` },
    ]);
    return validateCoachResponse(extractJSON(text));
  },

  async parseText(text: string, access: AiAccess, personality: CoachPersonality, weightKg?: number): Promise<CoachResponse> {
    assertAiReady(access, 'Smart AI Text parsing');

    const promptText = `Analyze the following text input: "${text}". Extract food the user ate and nutritional metrics.${weightNote(weightKg)}\nThe requested coaching personality is: "${sanitizePersonality(personality)}".`;

    const response = await runModel(credsFrom(access), [{ text: `${SYSTEM_PROMPT}\n\n${promptText}` }]);
    return validateCoachResponse(extractJSON(response));
  },

  async parseImage(blob: Blob, access: AiAccess, personality: CoachPersonality, weightKg?: number): Promise<CoachResponse> {
    assertAiReady(access, 'Visual Photo Scanning');

    const promptText = `Analyze the uploaded image. It contains a meal, ingredients, or a nutrition facts label. Identify what it is, estimate portions, and calculate the nutritional metrics.${weightNote(weightKg)}\nThe requested coaching personality is: "${sanitizePersonality(personality)}".`;

    const text = await runModel(credsFrom(access), [
      await imagePart(blob),
      { text: `${SYSTEM_PROMPT}\n\n${promptText}` },
    ]);
    return validateCoachResponse(extractJSON(text));
  },

  async correctVoice(
    currentItems: Omit<FoodItem, 'id'>[],
    _currentWorkout: Omit<WorkoutLog, 'id'> | null,
    blob: Blob,
    access: AiAccess,
    personality: CoachPersonality,
    weightKg?: number
  ): Promise<CoachResponse> {
    assertAiReady(access);

    const promptText = `
The staged food items currently are:
${JSON.stringify(currentItems, null, 2)}

The user spoke this correction, subtraction, or addition in the uploaded audio recording. Analyze it and output the updated full JSON with type "food" and an updated items array.${weightNote(weightKg)}
Requested personality: "${sanitizePersonality(personality)}".`;

    const text = await runModel(credsFrom(access), [
      await audioPart(blob),
      { text: `${SYSTEM_PROMPT}\n\n${promptText}` },
    ]);
    return validateCoachResponse(extractJSON(text));
  },

  async correctText(
    currentItems: Omit<FoodItem, 'id'>[],
    _currentWorkout: Omit<WorkoutLog, 'id'> | null,
    text: string,
    access: AiAccess,
    personality: CoachPersonality,
    weightKg?: number
  ): Promise<CoachResponse> {
    assertAiReady(access);

    const promptText = `
The staged food items currently are:
${JSON.stringify(currentItems, null, 2)}

The user wrote this correction: "${text}". Analyze it and output the updated full JSON with type "food" and an updated items array.${weightNote(weightKg)}
Requested personality: "${sanitizePersonality(personality)}".`;

    const response = await runModel(credsFrom(access), [{ text: `${SYSTEM_PROMPT}\n\n${promptText}` }]);
    return validateCoachResponse(extractJSON(response));
  },

  /** Parse a free-text recipe description into a structured Recipe (per-ingredient macros). */
  async parseRecipeDescription(description: string, access: AiAccess): Promise<Omit<Recipe, 'id'>> {
    assertAiReady(access, 'AI Recipe Parsing');
    const RECIPE_PARSER_PROMPT = `
You are the HelloCal Recipe Creator Assistant. Analyze a natural-language recipe description (ingredients, weights, volumes, servings) and parse it into a structured Recipe object.
Estimate calories, protein, carbs, fat, sugar, addedSugar, fiber, sodium for every ingredient if not provided, using standard nutritional databases for cups/tbsp/oz/grams. Be accurate; total macros are the sum of ingredients. Set missing/negligible micros to 0.
Respond with ONLY a JSON object (no markdown):
{
  "name": "Recipe Name",
  "servings": 12,
  "yieldUnit": "cookie" | "cup" | "serving" | "slice" | "grams",
  "ingredients": [
    { "name": "Rolled Oats", "quantity": "2 cups", "calories": 300, "protein": 10.0, "carbs": 54.0, "fat": 5.0, "sugar": 1.0, "addedSugar": 0.0, "fiber": 8.0, "sodium": 2 }
  ]
}`;
    const text = await runModel(credsFrom(access), [
      { text: `${RECIPE_PARSER_PROMPT}\n\nAnalyze the following recipe description and parse it into structured JSON:\n"${description}"` },
    ]);
    // Run the raw AI output through the same recipe sanitizer used on load, so NaN/
    // negative/string macros and sub-1 servings can't reach saved recipes (extractJSON
    // alone trusts whatever the model emits). Default a missing name to the description
    // first, since callers like the per-ingredient auto-estimate only read .ingredients
    // and a valid nameless ingredient list would otherwise be dropped by the !name gate.
    const obj = extractJSON<Record<string, unknown>>(text);
    if (!obj.name || typeof obj.name !== 'string' || !obj.name.trim()) {
      obj.name = description.slice(0, 60) || 'Recipe';
    }
    const [recipe] = sanitizeRecipes([obj]);
    if (!recipe) throw new Error("Couldn't parse a recipe from that. Try listing the ingredients, quantities, and servings.");
    const { id: _id, ...rest } = recipe;
    void _id;
    return rest;
  },

  /** Look up clinical info for a custom micronutrient (for the dashboard micro tracker). */
  async fetchMicronutrientInfo(name: string, access: AiAccess): Promise<{ name: string; emoji: string; unit: string; dailyLimit: number; isLimit: boolean; color: string; glowColor: string }> {
    assertAiReady(access);
    const text = await runModel(credsFrom(access), [{
      text: `You are a clinical nutrition database. For the micronutrient "${name}", return a JSON object with:
- "name": properly capitalized full name (e.g. "Vitamin D3", "Potassium", "Added Sugar")
- "emoji": a single relevant emoji
- "unit": the standard measurement unit ("g", "mg", "mcg", or "IU")
- "dailyLimit": the FDA/WHO recommended daily value as a number
- "isLimit": true if this is a nutrient to LIMIT (sodium, sugar, cholesterol), false if a TARGET to REACH (fiber, iron, vitamin D)
- "color": ONE of "var(--accent-purple)", "var(--accent-teal)", "var(--accent-amber)", "var(--accent-rose)", "var(--accent-blue)"
- "glowColor": the matching glow ("var(--accent-purple-glow)", etc.)
Respond ONLY with the JSON object, no markdown.` }]);
    const raw = extractJSON<{ name?: unknown; emoji?: unknown; unit?: unknown; dailyLimit?: unknown; isLimit?: unknown; color?: unknown; glowColor?: unknown }>(text);
    // Constrain the AI output to known units/colors so g-vs-mg confusion or a bogus
    // CSS var can't poison the micro HUD. The exact fieldKey->canonical-unit forcing
    // for data-backed nutrients happens in Dashboard.addMicro.
    const unit = MICRO_UNITS.includes(String(raw.unit)) ? String(raw.unit) : 'g';
    const colorIdx = MICRO_COLORS.indexOf(String(raw.color));
    const color = colorIdx >= 0 ? MICRO_COLORS[colorIdx] : 'var(--accent-blue)';
    const glowColor = colorIdx >= 0 ? color.replace(')', '-glow)') : 'var(--accent-blue-glow)';
    const dl = Number(raw.dailyLimit);
    return {
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : name,
      emoji: typeof raw.emoji === 'string' && raw.emoji ? raw.emoji : '✨',
      unit,
      dailyLimit: Number.isFinite(dl) && dl > 0 ? dl : 100,
      isLimit: raw.isLimit === true,
      color,
      glowColor,
    };
  },

  /** Look up standard dosage/schedule for a supplement by name. */
  async fetchSupplementInfo(name: string, access: AiAccess): Promise<{ name: string; dosage: string; schedule: string }> {
    assertAiReady(access);
    const text = await runModel(credsFrom(access), [{
      text: `You are a clinical supplement advisor. For the supplement "${name}", return a JSON object with:
- "name": properly capitalized full supplement name (e.g. "Vitamin D3", "Omega-3 Fish Oil", "Magnesium Glycinate")
- "dosage": the standard recommended daily dosage as a string (e.g. "1 capsule (1000 IU)", "2 softgels (1000mg)")
- "schedule": the optimal time, exactly one of: "Morning", "Lunch", or "Bedtime"
Respond ONLY with the JSON object, no markdown.` }]);
    const raw = extractJSON<{ name?: unknown; dosage?: unknown; schedule?: unknown }>(text);
    return {
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : name,
      dosage: typeof raw.dosage === 'string' ? raw.dosage : '',
      schedule: typeof raw.schedule === 'string' ? raw.schedule : 'Morning',
    };
  },
};
