// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  average,
  buildAnalyticsInsights,
  buildHeatmapCells,
  calorieBarSemanticColor,
  dailyWaterMl,
  dayOfWeekCalorieAverages,
  formatPeriodDelta,
  hydrationGoalMetDays,
  macroOnPlanDays,
} from './analyticsInsights';
import { resolveAnalyticsWindow } from './analyticsRange';
import type { MealLog, UserGoals, WaterLog } from '../types/nutrition';

const goals: UserGoals = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
  hydration: 2000,
};

const meal = (ts: number, calories: number, protein = 0): MealLog => ({
  id: `m-${ts}`,
  timestamp: ts,
  mealType: 'lunch',
  items: [
    {
      id: 'i1',
      name: 'Food',
      quantity: '1',
      calories,
      protein,
      carbs: 0,
      fat: 0,
      confidence: 'high',
    },
  ],
});

describe('analyticsInsights', () => {
  it('colors calorie bars by distance from goal', () => {
    expect(calorieBarSemanticColor(1980, 2000)).toContain('16, 185, 129');
    expect(calorieBarSemanticColor(2300, 2000)).toContain('245, 158, 11');
    expect(calorieBarSemanticColor(2800, 2000)).toContain('244, 63, 94');
    expect(calorieBarSemanticColor(0, 2000)).toContain('255, 255, 255');
  });

  it('formats period deltas', () => {
    expect(formatPeriodDelta(2100, 2000).tone).toBe('up');
    expect(formatPeriodDelta(1800, 2000).tone).toBe('down');
    expect(formatPeriodDelta(2000, 2000).text).toMatch(/Same/);
  });

  it('averages numeric series', () => {
    expect(average([100, 200, 300])).toBe(200);
    expect(average([])).toBe(0);
  });

  it('sums daily water from water logs', () => {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    const logs: WaterLog[] = [
      { id: 'w1', timestamp: day.getTime(), milliliters: 250 },
      { id: 'w2', timestamp: day.getTime() + 3600_000, milliliters: 500 },
    ];
    expect(dailyWaterMl(logs, day.getTime())).toBe(750);
  });

  it('counts hydration goal met days', () => {
    expect(hydrationGoalMetDays([2000, 1500, 2100], 2000)).toBe(2);
  });

  it('builds heatmap levels from calorie adherence', () => {
    const days = [new Date(2026, 5, 1), new Date(2026, 5, 2), new Date(2026, 5, 3)];
    const cells = buildHeatmapCells(days, [0, 2010, 2200], 2000);
    expect(cells[0].level).toBe(0);
    expect(cells[1].level).toBe(3);
    expect(cells[2].level).toBe(2);
  });

  it('aggregates weekday calorie averages', () => {
    const sun = new Date(2026, 5, 7);
    const mon = new Date(2026, 5, 8);
    const buckets = dayOfWeekCalorieAverages([sun, mon], [3000, 2000]);
    expect(buckets.find((b) => b.label === 'Sun')?.avg).toBe(3000);
    expect(buckets.find((b) => b.label === 'Mon')?.avg).toBe(2000);
  });

  it('counts macro on-plan days with tolerance', () => {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    const logs = [meal(day.getTime(), 2000, 155)];
    const days = [new Date(day)];
    days[0].setHours(0, 0, 0, 0);
    expect(macroOnPlanDays(logs, goals, days, ['protein'])).toBe(1);
  });

  it('builds insights including protein gap when below target', () => {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const logs = [meal(start.getTime() + 3600_000, 1800, 80)];
    const window = resolveAnalyticsWindow(logs, 7);
    const insights = buildAnalyticsInsights({
      logs,
      goals,
      window,
      dailyCalories: window.days.map((d) =>
        d.getTime() === start.getTime() ? 1800 : 0
      ),
      priorDailyCalories: window.days.map(() => 0),
      visibleMacroKeys: ['protein'],
      visibleMicros: [],
      waterLogs: [],
      supplements: [],
    });
    expect(insights.some((i) => i.id === 'protein-gap')).toBe(true);
  });
});
