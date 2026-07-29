import { describe, it, expect } from 'vitest';
import { computeDailyTotals } from './dailyTotals';
import type { FoodItem, MealLog, WorkoutLog, Supplement } from '../types/nutrition';

const DAY = 86400000;
const TS = new Date(2026, 5, 13, 12, 0, 0).getTime(); // local noon, 2026-06-13

const item = (o: Partial<FoodItem>): FoodItem => ({
  id: Math.random().toString(36).slice(2),
  name: 'X',
  quantity: '1',
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  confidence: 'high',
  ...o,
});
const meal = (timestamp: number, mealType: MealLog['mealType'], items: FoodItem[]): MealLog => ({
  id: Math.random().toString(36).slice(2),
  timestamp,
  mealType,
  items,
});
const wk = (timestamp: number, caloriesBurned: number, duration: number): WorkoutLog => ({
  id: Math.random().toString(36).slice(2),
  timestamp,
  activity: 'Run',
  caloriesBurned,
  duration,
});

describe('computeDailyTotals', () => {
  it('sums only entries within the local day (half-open window)', () => {
    const logs = [
      meal(TS, 'breakfast', [item({ calories: 100, protein: 10 })]),
      meal(TS + 1000, 'lunch', [item({ calories: 200, protein: 20 })]),
      meal(TS - DAY, 'dinner', [item({ calories: 999 })]), // yesterday — excluded
      meal(TS + DAY, 'snack', [item({ calories: 999 })]), // tomorrow — excluded
    ];
    const workouts = [wk(TS, 300, 30), wk(TS - DAY, 500, 60)];
    const t = computeDailyTotals(logs, workouts, TS);
    expect(t.todayLogs).toHaveLength(2);
    expect(t.consumedCalories).toBe(300);
    expect(t.consumedProtein).toBe(30);
    expect(t.totalBurnedCalories).toBe(300);
    expect(t.totalWorkoutMinutes).toBe(30);
  });

  it('counts added sugar only, never total sugar', () => {
    const logs = [meal(TS, 'breakfast', [item({ calories: 100, sugar: 25, addedSugar: 4, fiber: 3, sodium: 150 })])];
    const t = computeDailyTotals(logs, [], TS);
    expect(t.consumedAddedSugar).toBe(4);
    expect(t.consumedFiber).toBe(3);
    expect(t.consumedSodium).toBe(150);
  });

  it('tallies meal-type counts', () => {
    const logs = [
      meal(TS, 'breakfast', [item({ calories: 1 })]),
      meal(TS + 1, 'breakfast', [item({ calories: 1 })]),
      meal(TS + 2, 'lunch', [item({ calories: 1 })]),
      meal(TS + 3, 'snack', [item({ calories: 1 })]),
    ];
    const t = computeDailyTotals(logs, [], TS);
    expect(t.breakfastCount).toBe(2);
    expect(t.lunchCount).toBe(1);
    expect(t.dinnerCount).toBe(0);
    expect(t.snackCount).toBe(1);
  });

  it('defends against NaN/garbage values', () => {
    const logs = [meal(TS, 'lunch', [item({ calories: NaN as unknown as number, protein: 'x' as unknown as number })])];
    const t = computeDailyTotals(logs, [], TS);
    expect(t.consumedCalories).toBe(0);
    expect(t.consumedProtein).toBe(0);
  });

  it('returns zeroed totals for an empty day', () => {
    const t = computeDailyTotals([], [], TS);
    expect(t.consumedCalories).toBe(0);
    expect(t.todayLogs).toEqual([]);
    expect(t.breakfastCount).toBe(0);
  });

  it('sums taken supplements to micro/macro daily totals', () => {
    const supplements: Supplement[] = [
      { id: 's1', name: 'Protein powder', dosage: '1 scoop', schedule: 'Morning', takenToday: true, calories: 120, protein: 25, carbs: 2 },
      { id: 's2', name: 'Fish oil', dosage: '1 softgel', schedule: 'Evening', takenToday: false, calories: 10, fat: 1 },
    ];
    const t = computeDailyTotals([], [], Date.now(), supplements);
    expect(t.consumedCalories).toBe(120);
    expect(t.consumedProtein).toBe(25);
    expect(t.consumedCarbs).toBe(2);
    expect(t.consumedFat).toBe(0);
  });
});
