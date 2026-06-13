import type { MealLog, WorkoutLog, FavoriteFood, MealTemplate } from '../types/nutrition';
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
      timestamp: nonNeg((log as { timestamp?: unknown }).timestamp, Date.now()) || Date.now(),
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
      timestamp: nonNeg((w as { timestamp?: unknown }).timestamp, Date.now()) || Date.now(),
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
      createdAt: nonNeg(o.createdAt, Date.now()) || Date.now(),
    });
  }
  return out;
}
