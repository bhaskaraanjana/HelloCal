import type { MealLog } from '../types/nutrition';

/** Numeric nutrient fields shared by FoodItem-shaped records. */
export const NUTRIENT_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'sugar', 'addedSugar', 'fiber', 'sodium'] as const;

/**
 * Scale every present numeric nutrient field of a food-item-shaped record by a
 * factor. Calories/sodium round to integers; the rest keep one decimal. Any
 * non-numeric/absent field is left untouched, and a passed `id` is preserved.
 * Generic so it serves both FoodItem and Omit<FoodItem,'id'>.
 */
export function scaleNutrients<T extends object>(item: T, factor: number): T {
  const out = { ...item } as Record<string, unknown>;
  for (const k of NUTRIENT_FIELDS) {
    const v = out[k];
    if (typeof v === 'number') {
      const scaled = v * factor;
      out[k] = k === 'calories' || k === 'sodium' ? Math.round(scaled) : Math.round(scaled * 10) / 10;
    }
  }
  return out as unknown as T;
}

/** The meal slot HaloCal auto-assigns from a local time (defaults to now). */
export function autoMealSlot(now: Date = new Date()): MealLog['mealType'] {
  const hour = now.getHours();
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'snack';
}
