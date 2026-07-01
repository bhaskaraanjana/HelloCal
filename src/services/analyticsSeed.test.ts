import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildAnalyticsSeed } from './analyticsSeed';
import { resolveAnalyticsWindow } from './analyticsRange';
import { buildAnalyticsInsights, dailyWaterSeries, daysWithMealLogs } from './analyticsInsights';
import { computeDailyTotals } from './dailyTotals';

const REF = new Date(2026, 5, 15, 12, 0, 0).getTime();

describe('analyticsSeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(REF);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces 14 days of meals and water', () => {
    const seed = buildAnalyticsSeed();
    expect(seed.logs.length).toBeGreaterThan(40);
    expect(seed.waterLogs.length).toBe(28);
    expect(seed.supplements.length).toBe(2);
    const window = resolveAnalyticsWindow(seed.logs, 14);
    expect(window.dayCount).toBe(14);
    expect(daysWithMealLogs(seed.logs, window.startOfPeriod, window.endOfPeriod)).toBe(14);
  });

  it('drives non-empty analytics insights', () => {
    const seed = buildAnalyticsSeed();
    const window = resolveAnalyticsWindow(seed.logs, 14);
    const dailyCalories = window.days.map(
      (d) => computeDailyTotals(seed.logs, [], d.getTime()).consumedCalories
    );
    const priorStart = window.startOfPeriod - (window.endOfPeriod - window.startOfPeriod);
    const priorDailyCalories = Array.from({ length: window.dayCount }, (_, i) => {
      const day = new Date(priorStart + i * 24 * 3600_000);
      return computeDailyTotals(seed.logs, [], day.getTime()).consumedCalories;
    });
    const insights = buildAnalyticsInsights({
      logs: seed.logs,
      goals: seed.goals,
      window,
      dailyCalories,
      priorDailyCalories,
      visibleMacroKeys: ['protein', 'carbs', 'fat'],
      visibleMicros: [],
      waterLogs: seed.waterLogs,
      supplements: seed.supplements,
    });
    expect(insights.length).toBeGreaterThan(0);
    const water = dailyWaterSeries(seed.waterLogs, window.days);
    expect(water.some((ml) => ml >= 2000)).toBe(true);
    expect(dailyCalories.some((c) => c > 2200)).toBe(true);
  });
});
