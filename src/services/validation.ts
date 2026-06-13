import type {
  CoachResponse,
  CommandResponse,
  FoodItem,
  WorkoutLog,
  UserGoals,
  CoachPersonality,
} from '../types/nutrition';

/**
 * Robustly extract a JSON object from a raw LLM response string.
 * Handles markdown code fences (```json ... ```), leading/trailing prose,
 * and stray preamble that occasionally slips past responseMimeType: application/json.
 */
export function extractJSON<T = unknown>(raw: string): T {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty AI response.');
  }

  const trimmed = raw.trim();

  // If the response is fenced, restrict BOTH the fast path and the balanced scan to
  // the region from the opening fence onward. This excludes any prose before the
  // fence (which could otherwise supply a wrong balanced object) while still letting
  // the depth/string-aware scan recover JSON whose string values contain an inner
  // ``` sequence (which truncates the lazy fence capture). No fence => scan it all.
  let scanStr = trimmed;
  let fastText = trimmed;
  const fenceOpen = trimmed.match(/```(?:json)?\s*/i);
  if (fenceOpen && fenceOpen.index !== undefined) {
    const afterOpen = trimmed.slice(fenceOpen.index + fenceOpen[0].length);
    scanStr = afterOpen;
    const lazy = afterOpen.match(/([\s\S]*?)```/);
    fastText = (lazy ? lazy[1] : afterOpen).trim();
  }

  // Fast path: already-clean JSON (inside the fence, or the whole string).
  try {
    return JSON.parse(fastText) as T;
  } catch {
    // Fall through to brace extraction.
  }

  // Extract the first balanced {...} block. A naive first-'{'/last-'}' slice breaks
  // when the model emits trailing prose containing a '}' (e.g. inside an emoji-laden
  // coachingMessage), so scan with brace depth while respecting string literals.
  const block = extractBalancedObject(scanStr);
  if (block) {
    try {
      return JSON.parse(block) as T;
    } catch {
      /* fall through to the shared error */
    }
  }
  throw new Error('Could not read the AI response. Please try again.');
}

/** Return the first balanced top-level {...} substring, or null if none. */
function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

const VALID_PERSONALITIES: CoachPersonality[] = [
  'encouraging',
  'strict',
  'analytical',
  'chill',
];

/** Ensure a personality string is one of the allowed enum values (prevents prompt injection via free text). */
export function sanitizePersonality(p: unknown): CoachPersonality {
  return VALID_PERSONALITIES.includes(p as CoachPersonality)
    ? (p as CoachPersonality)
    : 'encouraging';
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function coerceFoodItem(raw: any, opts?: { applyDriftGate?: boolean }): Omit<FoodItem, 'id'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;

  const calories = Math.round(num(raw.calories));
  const protein = Math.round(num(raw.protein) * 10) / 10;
  const carbs = Math.round(num(raw.carbs) * 10) / 10;
  const fat = Math.round(num(raw.fat) * 10) / 10;

  // addedSugar can never exceed total sugar (manufacturer-added ⊆ total).
  let sugar = raw.sugar != null ? Math.round(num(raw.sugar) * 10) / 10 : undefined;
  let addedSugar = raw.addedSugar != null ? Math.round(num(raw.addedSugar) * 10) / 10 : undefined;
  if (sugar != null && addedSugar != null && addedSugar > sugar) {
    addedSugar = sugar;
  }

  // Macro/calorie sanity gate: protein*4 + carbs*4 + fat*9 should roughly match
  // the stated calories. A large mismatch means the AI hallucinated one of the
  // numbers, which would silently corrupt the user's calorie budget — the app's
  // core source of trust. Flag it as a guess so the refinement UI surfaces it.
  // ONLY apply to fresh AI output (opts.applyDriftGate): on the load/sanitize path
  // this would silently re-downgrade already-confirmed 'high' items every reload
  // (e.g. alcohol/fiber-heavy foods where 4/4/9 genuinely doesn't sum), mutating
  // persisted, user-trusted data.
  let confidence: 'high' | 'guess' = raw.confidence === 'high' ? 'high' : 'guess';
  if (opts?.applyDriftGate && calories > 0) {
    const macroKcal = protein * 4 + carbs * 4 + fat * 9;
    const drift = Math.abs(macroKcal - calories) / calories;
    if (drift > 0.2) confidence = 'guess';
  }

  return {
    name,
    quantity: typeof raw.quantity === 'string' && raw.quantity.trim() ? raw.quantity.trim() : '1 serving',
    calories,
    protein,
    carbs,
    fat,
    sugar,
    addedSugar,
    fiber: raw.fiber != null ? Math.round(num(raw.fiber) * 10) / 10 : undefined,
    sodium: raw.sodium != null ? Math.round(num(raw.sodium)) : undefined,
    iron: raw.iron != null ? Math.round(num(raw.iron) * 10) / 10 : undefined,
    confidence,
  };
}

function coerceWorkout(raw: any): Omit<WorkoutLog, 'id' | 'timestamp'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const activity = typeof raw.activity === 'string' ? raw.activity.trim() : '';
  if (!activity) return null;

  // Upper-clamp to plausible human limits so a hallucinated burn (e.g. 50000 kcal)
  // can't silently inflate the eatable calorie budget — the food path has a drift
  // gate, workouts need an analogous sanity ceiling. 1440 min = 24h; 5000 kcal is a
  // generous all-day ceiling (an Ironman is ~8000–10000 over many hours, rare here).
  return {
    activity,
    duration: Math.min(Math.round(num(raw.duration)), 1440),
    caloriesBurned: Math.min(Math.round(num(raw.caloriesBurned)), 5000),
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
  };
}

/**
 * Validate and normalize a parsed CoachResponse from the LLM.
 * Throws a user-facing error if the response is structurally unusable.
 */
export function validateCoachResponse(raw: any): CoachResponse {
  if (!raw || typeof raw !== 'object' || !raw.type) {
    throw new Error('The AI response was incomplete. Please try again.');
  }

  const type: CoachResponse['type'] =
    raw.type === 'workout' || raw.type === 'mixed' ? raw.type : 'food';

  const items = Array.isArray(raw.items)
    ? raw.items.map((it: any) => coerceFoodItem(it, { applyDriftGate: true })).filter(Boolean) as Omit<FoodItem, 'id'>[]
    : [];

  const workout = coerceWorkout(raw.workout) as Omit<WorkoutLog, 'id'> | null;

  if (items.length === 0 && !workout) {
    throw new Error("Couldn't detect any food or workout in that. Try rephrasing.");
  }

  return {
    type,
    items,
    workout: workout || undefined,
    coachingMessage:
      typeof raw.coachingMessage === 'string' ? raw.coachingMessage : '',
  };
}

/** Validate a CommandResponse (dashboard customizer). Lenient — only the shape we trust passes through. */
export function validateCommandResponse(raw: any): CommandResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('The AI customizer response was unreadable. Please try again.');
  }
  return {
    updatedGoals: raw.updatedGoals && typeof raw.updatedGoals === 'object' ? raw.updatedGoals : {},
    updatedSettings: raw.updatedSettings && typeof raw.updatedSettings === 'object' ? raw.updatedSettings : {},
    aiResponse: typeof raw.aiResponse === 'string' ? raw.aiResponse : 'Done!',
  };
}

/** Bounds for daily nutrition goals (loosely aligned with FDA daily values + safety limits). */
export const GOAL_BOUNDS: Record<keyof UserGoals, { min: number; max: number }> = {
  calories: { min: 1000, max: 6000 },
  protein: { min: 10, max: 500 },
  carbs: { min: 0, max: 800 },
  fat: { min: 0, max: 400 },
  addedSugar: { min: 0, max: 200 },
  fiber: { min: 5, max: 150 },
  sodium: { min: 200, max: 6000 },
  waterTarget: { min: 250, max: 8000 },
  hydration: { min: 250, max: 8000 },
  iron: { min: 5, max: 45 },
};

export function clampGoal(field: keyof UserGoals, value: number, fallback: number): number {
  const b = GOAL_BOUNDS[field];
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, b.min), b.max);
}

const isRetryable = (err: any): boolean => {
  const msg = String(err?.message || err || '').toLowerCase();
  const status = err?.status || err?.code;
  if (status === 429 || status === 500 || status === 503) return true;
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('500') ||
    msg.includes('503')
  );
};

/**
 * Retry an async fn with exponential backoff, but only for transient/retryable errors.
 * Final failure rethrows a user-friendly message.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 800,
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isRetryable(err)) break;
      const delay = baseDelayMs * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  const msg = String(lastErr?.message || '').toLowerCase();
  if (msg.includes('quota') || msg.includes('429') || msg.includes('rate')) {
    throw new Error('AI quota reached. Please wait about a minute and try again.');
  }
  if (msg.includes('api key') || msg.includes('api_key') || msg.includes('permission') || msg.includes('401') || msg.includes('403')) {
    throw new Error('Your Gemini API key was rejected. Check it in Settings.');
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
    throw new Error('Network issue reaching the AI. Check your connection and retry.');
  }
  throw lastErr instanceof Error ? lastErr : new Error('The AI request failed. Please try again.');
}
