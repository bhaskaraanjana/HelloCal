import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FoodItem, WorkoutLog, CoachPersonality, CoachResponse, UserGoals, AppSettings, CommandResponse, Recipe } from '../types/nutrition';
import {
  extractJSON,
  validateCoachResponse,
  validateCommandResponse,
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
Identify the activity and duration in minutes. Estimate calories burned in kcal using standard MET (Metabolic Equivalent) values, assuming a 75 kg (165 lb) adult unless the user states otherwise. Use the standard ACSM formula: caloriesBurned = MET * 3.5 * 75 * duration_minutes / 200. Reference METs: walking 3.5, brisk walking 4.3, running (6 mph) 9.8, cycling (moderate) 7.5, swimming 8.0, weightlifting 4.0, yoga 2.5, HIIT 9.0, elliptical 5.0, hiking 6.0. If the user explicitly gives calories burned, use their number.

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
    const resp = result.response;
    // A safety/recitation block or an empty candidate makes the SDK's text() throw an
    // opaque, non-retryable error ("Text not available. Response was blocked due to
    // SAFETY"). Detect it and surface a friendly, actionable message instead.
    const blockReason = resp?.promptFeedback?.blockReason;
    const finishReason = resp?.candidates?.[0]?.finishReason;
    if (blockReason || finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
      throw new Error("The AI couldn't process that input. Try rephrasing, or use a clearer photo.");
    }
    try {
      return resp.text();
    } catch {
      throw new Error("The AI returned an empty response. Please try again.");
    }
  });
}

/** A per-call instruction that overrides the prompt's default 75 kg assumption. */
const weightNote = (weightKg?: number): string =>
  weightKg && weightKg > 0
    ? ` The user weighs ${Math.round(weightKg)} kg; use THIS weight for MET-based workout calorie burn (caloriesBurned = MET * 3.5 * ${Math.round(weightKg)} * minutes / 200, the standard ACSM formula) unless they explicitly state calories.`
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

  /** Parse a free-text recipe description into a structured Recipe (per-ingredient macros). */
  async parseRecipeDescription(description: string, apiKey: string): Promise<Omit<Recipe, 'id'>> {
    if (!apiKey) throw new Error('Gemini API key is required to use AI Recipe Parsing.');
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
    const text = await runModel(apiKey, [
      { text: `${RECIPE_PARSER_PROMPT}\n\nAnalyze the following recipe description and parse it into structured JSON:\n"${description}"` },
    ]);
    // Run the raw AI output through the same recipe sanitizer used on load, so NaN/
    // negative/string macros, sub-1 servings, and nameless ingredients can't reach
    // saved recipes (extractJSON alone trusts whatever the model emits).
    const [recipe] = sanitizeRecipes([extractJSON(text)]);
    if (!recipe) throw new Error("Couldn't parse a recipe from that. Try listing the ingredients, quantities, and servings.");
    const { id: _id, ...rest } = recipe;
    void _id;
    return rest;
  },

  /** Look up clinical info for a custom micronutrient (for the dashboard micro tracker). */
  async fetchMicronutrientInfo(name: string, apiKey: string): Promise<{ name: string; emoji: string; unit: string; dailyLimit: number; isLimit: boolean; color: string; glowColor: string }> {
    if (!apiKey) throw new Error('Gemini API key is required.');
    const text = await runModel(apiKey, [{
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
  async fetchSupplementInfo(name: string, apiKey: string): Promise<{ name: string; dosage: string; schedule: string }> {
    if (!apiKey) throw new Error('Gemini API key is required.');
    const text = await runModel(apiKey, [{
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
