import type { MealLog } from '../types/nutrition';

/** Numeric nutrient fields shared by FoodItem-shaped records. */
export const NUTRIENT_FIELDS = [
  'calories', 'protein', 'carbs', 'fat',
  'sugar', 'addedSugar', 'fiber', 'sodium', 'iron',
  'calcium', 'potassium', 'cholesterol', 'saturatedFat', 'transFat',
  'vitaminA', 'vitaminC', 'vitaminD', 'vitaminB12', 'zinc', 'magnesium', 'folate'
] as const;

/**
 * Scale every present numeric nutrient field of a food-item-shaped record by a
 * factor. Calories and integer micronutrients round to integers; the rest keep one decimal.
 * Any non-numeric/absent field is left untouched, and a passed `id` is preserved.
 * Generic so it serves both FoodItem and Omit<FoodItem,'id'>.
 */
export function scaleNutrients<T extends object>(item: T, factor: number): T {
  const out = { ...item } as Record<string, any>;
  for (const k of NUTRIENT_FIELDS) {
    const v = out[k];
    if (typeof v === 'number') {
      const scaled = v * factor;
      const isIntField = ['calories', 'sodium', 'potassium', 'calcium', 'cholesterol', 'magnesium'].includes(k);
      out[k] = isIntField ? Math.round(scaled) : Math.round(scaled * 10) / 10;
    }
  }
  if (out.micros && typeof out.micros === 'object') {
    const scaledMicros: Record<string, number> = {};
    for (const k of Object.keys(out.micros)) {
      const v = out.micros[k];
      if (typeof v === 'number') {
        scaledMicros[k] = Math.round(v * factor * 100) / 100;
      }
    }
    out.micros = scaledMicros;
  }
  return out as unknown as T;
}

/** Timestamp for logging to a calendar day: now if today, else same clock time on that day. */
export function logTimestampForDate(day: Date, now: Date = new Date()): number {
  const target = new Date(day);
  if (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  ) {
    return now.getTime();
  }
  target.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return target.getTime();
}

/** The meal slot HelloCal auto-assigns from a local time (defaults to now). */
export function autoMealSlot(now: Date = new Date()): MealLog['mealType'] {
  const hour = now.getHours();
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'snack';
}
