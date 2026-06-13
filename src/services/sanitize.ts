import type { MealLog, WorkoutLog, FavoriteFood, MealTemplate, WaterLog, BodyMetric, Recipe, RecipeIngredient, Supplement, HydrationLog, MealPreset, CustomMicro } from '../types/nutrition';
import { coerceFoodItem } from './validation';

/**
 * Defensive sanitizers for data loaded from localStorage / imported backups.
 *
 * The app stores plain JSON that a user could hand-edit, that a partial quota
 * write could truncate, or that an older app version could have shaped
 * differently. These pure functions guarantee the rest of the app only ever sees
 * well-formed records: finite non-negative numbers, valid enums, and stable ids —
 * so a corrupt store degrades gracefully (dropping bad rows) instead of rendering
 * "NaN" or throwing.
 */

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

let idCounter = 0;
const rndId = (prefix: string): string => {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 6)}`;
};

const finiteNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const nonNeg = (v: unknown, fallback = 0): number => {
  const n = finiteNum(v, fallback);
  return n >= 0 ? n : fallback;
};
const strId = (v: unknown, prefix: string): string =>
  typeof v === 'string' && v.trim() ? v : rndId(prefix);

/** Coerce an array of raw meal logs into valid MealLog[]; drops empty/invalid logs. */
export function sanitizeMealLogs(raw: unknown): MealLog[] {
  if (!Array.isArray(raw)) return [];
  const out: MealLog[] = [];
  for (const log of raw) {
    if (!log || typeof log !== 'object') continue;
    const rawItems = (log as { items?: unknown }).items;
    const items = Array.isArray(rawItems)
      ? rawItems
          .map((it) => {
            const c = coerceFoodItem(it);
            return c ? { ...c, id: strId((it as { id?: unknown })?.id, 'item') } : null;
          })
          .filter(Boolean)
      : [];
    if (items.length === 0) continue; // a meal with no valid items is meaningless
    const mt = (log as { mealType?: unknown }).mealType;
    out.push({
      id: strId((log as { id?: unknown }).id, 'meal'),
      timestamp: nonNeg((log as { timestamp?: unknown }).timestamp) || Date.now(),
      mealType: (MEAL_TYPES as readonly string[]).includes(mt as string) ? (mt as MealLog['mealType']) : 'snack',
      items: items as MealLog['items'],
    });
  }
  return out;
}

/** Coerce an array of raw workouts into valid WorkoutLog[]; drops nameless rows. */
export function sanitizeWorkouts(raw: unknown): WorkoutLog[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkoutLog[] = [];
  for (const w of raw) {
    if (!w || typeof w !== 'object') continue;
    const activity = typeof (w as { activity?: unknown }).activity === 'string' ? (w as { activity: string }).activity.trim() : '';
    if (!activity) continue;
    out.push({
      id: strId((w as { id?: unknown }).id, 'workout'),
      timestamp: nonNeg((w as { timestamp?: unknown }).timestamp) || Date.now(),
      activity,
      duration: Math.round(nonNeg((w as { duration?: unknown }).duration)),
      caloriesBurned: Math.round(nonNeg((w as { caloriesBurned?: unknown }).caloriesBurned)),
      notes: typeof (w as { notes?: unknown }).notes === 'string' ? (w as { notes: string }).notes : undefined,
    });
  }
  return out;
}

/** Coerce an array of raw favorites into valid FavoriteFood[]; drops nameless rows. */
export function sanitizeFavorites(raw: unknown): FavoriteFood[] {
  if (!Array.isArray(raw)) return [];
  const out: FavoriteFood[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const o = f as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) continue;
    out.push({
      id: strId(o.id, 'fav'),
      name,
      quantity: typeof o.quantity === 'string' && o.quantity.trim() ? o.quantity : '1 serving',
      calories: Math.round(nonNeg(o.calories)),
      protein: nonNeg(o.protein),
      carbs: nonNeg(o.carbs),
      fat: nonNeg(o.fat),
      sugar: o.sugar != null ? nonNeg(o.sugar) : undefined,
      addedSugar: o.addedSugar != null ? nonNeg(o.addedSugar) : undefined,
      fiber: o.fiber != null ? nonNeg(o.fiber) : undefined,
      sodium: o.sodium != null ? Math.round(nonNeg(o.sodium)) : undefined,
      frequency: Math.max(1, Math.round(nonNeg(o.frequency, 1))),
      lastLogged: nonNeg(o.lastLogged),
      pinned: o.pinned === true ? true : undefined,
    });
  }
  return out;
}

/** Coerce raw water logs; drops rows with no positive volume. */
export function sanitizeWaterLogs(raw: unknown): WaterLog[] {
  if (!Array.isArray(raw)) return [];
  const out: WaterLog[] = [];
  for (const w of raw) {
    if (!w || typeof w !== 'object') continue;
    const o = w as Record<string, unknown>;
    const milliliters = Math.round(nonNeg(o.milliliters));
    if (milliliters <= 0) continue;
    out.push({ id: strId(o.id, 'water'), timestamp: nonNeg(o.timestamp) || Date.now(), milliliters });
  }
  return out;
}

/** Coerce raw body metrics; drops rows with no positive weight. */
export function sanitizeBodyMetrics(raw: unknown): BodyMetric[] {
  if (!Array.isArray(raw)) return [];
  const out: BodyMetric[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    const o = b as Record<string, unknown>;
    const weight = nonNeg(o.weight);
    if (weight <= 0) continue;
    out.push({
      id: strId(o.id, 'body'),
      timestamp: nonNeg(o.timestamp) || Date.now(),
      weight,
      unit: o.unit === 'lb' ? 'lb' : 'kg',
      bodyFat: o.bodyFat != null ? nonNeg(o.bodyFat) : undefined,
      waist: o.waist != null ? nonNeg(o.waist) : undefined,
    });
  }
  return out;
}

/** Coerce raw hydration logs; drops rows with no positive amount. */
export function sanitizeHydrationLogs(raw: unknown): HydrationLog[] {
  if (!Array.isArray(raw)) return [];
  const out: HydrationLog[] = [];
  for (const h of raw) {
    if (!h || typeof h !== 'object') continue;
    const o = h as Record<string, unknown>;
    const amount = Math.round(nonNeg(o.amount));
    if (amount <= 0) continue;
    out.push({ id: strId(o.id, 'hyd'), timestamp: nonNeg(o.timestamp) || Date.now(), amount });
  }
  return out;
}

/** Coerce raw custom micronutrient definitions; drops entries missing name/fieldKey. */
export function sanitizeCustomMicros(raw: unknown): CustomMicro[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomMicro[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const o = m as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const fieldKey = typeof o.fieldKey === 'string' ? o.fieldKey.trim() : '';
    if (!name || !fieldKey) continue;
    out.push({
      id: strId(o.id, 'micro'),
      name,
      emoji: typeof o.emoji === 'string' && o.emoji ? o.emoji : '🔬',
      unit: typeof o.unit === 'string' && o.unit ? o.unit : 'g',
      dailyLimit: nonNeg(o.dailyLimit),
      isLimit: o.isLimit === true,
      color: typeof o.color === 'string' && o.color ? o.color : 'var(--accent-purple)',
      glowColor: typeof o.glowColor === 'string' && o.glowColor ? o.glowColor : 'var(--accent-purple-glow)',
      fieldKey,
      hidden: o.hidden === true ? true : undefined,
    });
  }
  return out;
}

/** Coerce raw supplements; drops nameless rows. */
export function sanitizeSupplements(raw: unknown): Supplement[] {
  if (!Array.isArray(raw)) return [];
  const out: Supplement[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) continue;
    out.push({
      id: strId(o.id, 'supp'),
      name,
      dosage: typeof o.dosage === 'string' ? o.dosage : '',
      schedule: typeof o.schedule === 'string' ? o.schedule : 'Morning',
      takenToday: o.takenToday === true,
      lastTakenTimestamp: o.lastTakenTimestamp != null ? nonNeg(o.lastTakenTimestamp) : undefined,
    });
  }
  return out;
}

const coerceIngredient = (raw: unknown): RecipeIngredient | null => {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!name) return null;
  return {
    name,
    quantity: typeof o.quantity === 'string' && o.quantity.trim() ? o.quantity : '1 serving',
    calories: Math.round(nonNeg(o.calories)),
    protein: nonNeg(o.protein),
    carbs: nonNeg(o.carbs),
    fat: nonNeg(o.fat),
    sugar: o.sugar != null ? nonNeg(o.sugar) : undefined,
    addedSugar: o.addedSugar != null ? nonNeg(o.addedSugar) : undefined,
    fiber: o.fiber != null ? nonNeg(o.fiber) : undefined,
    sodium: o.sodium != null ? Math.round(nonNeg(o.sodium)) : undefined,
    iron: o.iron != null ? nonNeg(o.iron) : undefined,
  };
};

/** Coerce raw recipes; drops unnamed or ingredient-less recipes. */
export function sanitizeRecipes(raw: unknown): Recipe[] {
  if (!Array.isArray(raw)) return [];
  const out: Recipe[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const ingredients = Array.isArray(o.ingredients)
      ? (o.ingredients.map(coerceIngredient).filter(Boolean) as RecipeIngredient[])
      : [];
    if (!name || ingredients.length === 0) continue;
    out.push({
      id: strId(o.id, 'recipe'),
      name,
      icon: typeof o.icon === 'string' && o.icon ? o.icon : '🍽️',
      servings: Math.max(1, Math.round(nonNeg(o.servings, 1)) || 1),
      yieldUnit: typeof o.yieldUnit === 'string' && o.yieldUnit ? o.yieldUnit : 'serving',
      ingredients,
    });
  }
  return out;
}

/** Coerce raw meal presets; drops unnamed or itemless presets. */
export function sanitizeMealPresets(raw: unknown): MealPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: MealPreset[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const items = Array.isArray(o.items) ? o.items.map((it) => coerceFoodItem(it)).filter(Boolean) : [];
    if (!name || items.length === 0) continue;
    out.push({
      id: strId(o.id, 'preset'),
      name,
      icon: typeof o.icon === 'string' && o.icon ? o.icon : '🍽️',
      items: items as MealPreset['items'],
      isCustomFood: o.isCustomFood === true ? true : undefined,
    });
  }
  return out;
}

/** Coerce an array of raw meal templates; drops unnamed or itemless templates. */
export function sanitizeMealTemplates(raw: unknown): MealTemplate[] {
  if (!Array.isArray(raw)) return [];
  const out: MealTemplate[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const items = Array.isArray(o.items) ? o.items.map((it) => coerceFoodItem(it)).filter(Boolean) : [];
    if (!name || items.length === 0) continue;
    out.push({
      id: strId(o.id, 'tmpl'),
      name,
      items: items as MealTemplate['items'],
      createdAt: nonNeg(o.createdAt) || Date.now(),
    });
  }
  return out;
}
