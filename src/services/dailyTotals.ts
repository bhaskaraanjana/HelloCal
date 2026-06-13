import type { MealLog, WorkoutLog } from '../types/nutrition';
import { dayRange } from './insights';

export interface DailyTotals {
  todayLogs: MealLog[];
  todayWorkouts: WorkoutLog[];
  consumedCalories: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  consumedAddedSugar: number;
  consumedFiber: number;
  consumedSodium: number;
  consumedIron: number;
  consumedSugar: number;
  totalBurnedCalories: number;
  totalWorkoutMinutes: number;
  breakfastCount: number;
  lunchCount: number;
  dinnerCount: number;
  snackCount: number;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * The single source of truth for a day's consumed/burned nutrition totals.
 * Filters to the local-day window [start, end) containing `ts` (half-open, so
 * late-night entries from adjacent days never leak in), and defends every field
 * with Number()||0. Added sugar counts ONLY item.addedSugar — natural fruit/dairy
 * sugar must not count against the added-sugar target.
 */
export function computeDailyTotals(logs: MealLog[], workouts: WorkoutLog[], ts: number = Date.now()): DailyTotals {
  const { start, end } = dayRange(ts);
  const todayLogs = logs.filter((l) => l.timestamp >= start && l.timestamp < end);
  const todayWorkouts = workouts.filter((w) => w.timestamp >= start && w.timestamp < end);

  const t: DailyTotals = {
    todayLogs,
    todayWorkouts,
    consumedCalories: 0,
    consumedProtein: 0,
    consumedCarbs: 0,
    consumedFat: 0,
    consumedAddedSugar: 0,
    consumedFiber: 0,
    consumedSodium: 0,
    consumedIron: 0,
    consumedSugar: 0,
    totalBurnedCalories: 0,
    totalWorkoutMinutes: 0,
    breakfastCount: 0,
    lunchCount: 0,
    dinnerCount: 0,
    snackCount: 0,
  };

  for (const log of todayLogs) {
    if (log.mealType === 'breakfast') t.breakfastCount++;
    else if (log.mealType === 'lunch') t.lunchCount++;
    else if (log.mealType === 'dinner') t.dinnerCount++;
    else t.snackCount++;
    for (const item of log.items) {
      t.consumedCalories += n(item.calories);
      t.consumedProtein += n(item.protein);
      t.consumedCarbs += n(item.carbs);
      t.consumedFat += n(item.fat);
      t.consumedAddedSugar += n(item.addedSugar);
      t.consumedFiber += n(item.fiber);
      t.consumedSodium += n(item.sodium);
      t.consumedIron += n(item.iron);
      t.consumedSugar += n(item.sugar);
    }
  }

  for (const w of todayWorkouts) {
    t.totalBurnedCalories += n(w.caloriesBurned);
    t.totalWorkoutMinutes += n(w.duration);
  }

  return t;
}

/**
 * Sum an arbitrary numeric FoodItem field across a day's logged items. Used by the
 * custom-micronutrient HUD — but callers must only pass DATA-BACKED field keys
 * (fields the AI parser actually populates), never an arbitrary custom key, or the
 * result would be a misleading 0.
 */
export function sumFieldKey(logs: MealLog[], fieldKey: string, ts: number = Date.now()): number {
  const { start, end } = dayRange(ts);
  let total = 0;
  for (const log of logs) {
    if (log.timestamp < start || log.timestamp >= end) continue;
    for (const item of log.items) {
      total += n((item as unknown as Record<string, unknown>)[fieldKey]);
    }
  }
  return total;
}
