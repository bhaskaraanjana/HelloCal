import type { MealLog, UserGoals, WaterLog, Supplement, CustomMicro } from '../types/nutrition';
import type { AnalyticsWindow } from './analyticsRange';
import { computeDailyTotals, sumFieldKeyBetween } from './dailyTotals';
import { computeStreak } from './insights';
import { MACRO_TRACKING_ROWS, type MacroGoalKey } from './trackingCatalog';

export const CALORIE_GOAL_TOLERANCE = 150;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type InsightTone = 'neutral' | 'positive' | 'warning';

export interface AnalyticsInsight {
  id: string;
  tone: InsightTone;
  text: string;
}

export interface PeriodDelta {
  text: string;
  tone: 'up' | 'down' | 'flat';
}

export interface HeatmapCell {
  date: Date;
  level: 0 | 1 | 2 | 3;
  calories: number;
}

export interface DayOfWeekBucket {
  label: string;
  avg: number;
  dayIndex: number;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function calorieBarSemanticColor(consumed: number, goal: number): string {
  if (consumed <= 0) return 'rgba(255, 255, 255, 0.07)';
  const diff = Math.abs(consumed - goal);
  if (diff <= CALORIE_GOAL_TOLERANCE) return 'rgba(16, 185, 129, 0.62)';
  if (diff <= CALORIE_GOAL_TOLERANCE * 2) return 'rgba(245, 158, 11, 0.58)';
  return 'rgba(244, 63, 94, 0.52)';
}

export function calorieBarBorderColor(consumed: number, goal: number): string {
  if (consumed <= 0) return 'rgba(255, 255, 255, 0.1)';
  const diff = Math.abs(consumed - goal);
  if (diff <= CALORIE_GOAL_TOLERANCE) return 'rgba(16, 185, 129, 0.9)';
  if (diff <= CALORIE_GOAL_TOLERANCE * 2) return 'rgba(245, 158, 11, 0.85)';
  return 'rgba(244, 63, 94, 0.85)';
}

export function resolvePriorWindow(window: AnalyticsWindow): {
  start: number;
  end: number;
  dayCount: number;
} {
  const spanMs = window.endOfPeriod - window.startOfPeriod;
  return {
    start: window.startOfPeriod - spanMs,
    end: window.startOfPeriod,
    dayCount: window.dayCount,
  };
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function formatPeriodDelta(current: number, prior: number): PeriodDelta {
  const diff = current - prior;
  if (Math.abs(diff) < 1) return { text: 'Same as prior period', tone: 'flat' };
  const pct = prior > 0 ? Math.round((diff / prior) * 100) : current > 0 ? 100 : 0;
  const arrow = diff > 0 ? '↑' : '↓';
  return {
    text: `${arrow} ${Math.abs(pct)}% vs prior period`,
    tone: diff > 0 ? 'up' : 'down',
  };
}

export function daysWithMealLogs(logs: MealLog[], start: number, end: number): number {
  const days = new Set<number>();
  for (const log of logs) {
    if (log.timestamp >= start && log.timestamp < end) {
      const d = new Date(log.timestamp);
      d.setHours(0, 0, 0, 0);
      days.add(d.getTime());
    }
  }
  return days.size;
}

export function dailyWaterMl(waterLogs: WaterLog[], dayTs: number): number {
  const start = new Date(dayTs);
  start.setHours(0, 0, 0, 0);
  const dayStart = start.getTime();
  const dayEnd = dayStart + MS_PER_DAY;
  return waterLogs
    .filter((w) => w.timestamp >= dayStart && w.timestamp < dayEnd)
    .reduce((sum, w) => sum + w.milliliters, 0);
}

export function dailyWaterSeries(waterLogs: WaterLog[], days: Date[]): number[] {
  return days.map((d) => dailyWaterMl(waterLogs, d.getTime()));
}

export function hydrationGoalMetDays(dailyMl: number[], goalMl: number): number {
  return dailyMl.filter((ml) => ml > 0 && ml >= goalMl).length;
}

/** Days in range where at least one supplement was marked taken (by lastTakenTimestamp). */
export function supplementCheckInDays(
  supplements: Supplement[],
  start: number,
  end: number
): number {
  const days = new Set<number>();
  for (const supp of supplements) {
    const ts = supp.lastTakenTimestamp;
    if (ts == null || ts < start || ts >= end) continue;
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    days.add(d.getTime());
  }
  return days.size;
}

export function macroGoalForKey(goals: UserGoals, key: MacroGoalKey): number {
  const row = MACRO_TRACKING_ROWS.find((r) => r.goalKey === key);
  const fromGoals = goals[key];
  if (typeof fromGoals === 'number' && fromGoals > 0) return fromGoals;
  return row?.defaultGoal ?? 0;
}

export function isMacroOnPlan(
  logs: MealLog[],
  goals: UserGoals,
  dayTs: number,
  visibleKeys: MacroGoalKey[]
): boolean {
  if (visibleKeys.length === 0) return false;
  const totals = computeDailyTotals(logs, [], dayTs);
  for (const key of visibleKeys) {
    const target = macroGoalForKey(goals, key);
    if (target <= 0) continue;
    let consumed = 0;
    if (key === 'protein') consumed = totals.consumedProtein;
    else if (key === 'carbs') consumed = totals.consumedCarbs;
    else if (key === 'fat') consumed = totals.consumedFat;
    else {
      for (const log of totals.todayLogs) {
        for (const item of log.items) {
          consumed += Number(item[key]) || 0;
        }
      }
    }
    const row = MACRO_TRACKING_ROWS.find((r) => r.goalKey === key);
    const isLimit = row?.defaultIsLimit ?? false;
    const tolerance = target * 0.15;
    if (isLimit) {
      if (consumed > target + tolerance) return false;
    } else if (consumed < target - tolerance) {
      return false;
    }
  }
  return true;
}

export function macroOnPlanDays(
  logs: MealLog[],
  goals: UserGoals,
  days: Date[],
  visibleKeys: MacroGoalKey[]
): number {
  return days.filter((d) => isMacroOnPlan(logs, goals, d.getTime(), visibleKeys)).length;
}

export function dayOfWeekCalorieAverages(
  days: Date[],
  dailyCalories: number[]
): DayOfWeekBucket[] {
  const sums = Array.from({ length: 7 }, () => 0);
  const counts = Array.from({ length: 7 }, () => 0);
  days.forEach((day, i) => {
    const cal = dailyCalories[i] ?? 0;
    if (cal <= 0) return;
    const idx = day.getDay();
    sums[idx] += cal;
    counts[idx] += 1;
  });
  return WEEKDAY_LABELS.map((label, dayIndex) => ({
    label,
    dayIndex,
    avg: counts[dayIndex] > 0 ? Math.round(sums[dayIndex] / counts[dayIndex]) : 0,
  }));
}

export function buildHeatmapCells(
  days: Date[],
  dailyCalories: number[],
  calorieGoal: number
): HeatmapCell[] {
  return days.map((date, i) => {
    const calories = dailyCalories[i] ?? 0;
    let level: HeatmapCell['level'] = 0;
    if (calories > 0) {
      level = 1;
      const diff = Math.abs(calories - calorieGoal);
      if (diff <= CALORIE_GOAL_TOLERANCE) level = 3;
      else if (diff <= CALORIE_GOAL_TOLERANCE * 2) level = 2;
    }
    return { date, calories, level };
  });
}

export function buildAnalyticsInsights(input: {
  logs: MealLog[];
  goals: UserGoals;
  window: AnalyticsWindow;
  dailyCalories: number[];
  priorDailyCalories: number[];
  visibleMacroKeys: MacroGoalKey[];
  visibleMicros: CustomMicro[];
  waterLogs: WaterLog[];
  supplements: Supplement[];
}): AnalyticsInsight[] {
  const {
    logs,
    goals,
    window,
    dailyCalories,
    priorDailyCalories,
    visibleMacroKeys,
    visibleMicros,
    waterLogs,
    supplements,
  } = input;
  const insights: AnalyticsInsight[] = [];
  const hydrationGoal = goals.hydration || 2000;

  const avg = Math.round(average(dailyCalories));
  const priorAvg = Math.round(average(priorDailyCalories));
  const delta = avg - priorAvg;
  if (priorDailyCalories.some((v) => v > 0) && Math.abs(delta) >= 50) {
    insights.push({
      id: 'calorie-trend',
      tone: delta > 150 ? 'warning' : delta < -150 ? 'positive' : 'neutral',
      text:
        delta > 0
          ? `Calorie average is ${Math.abs(delta)} kcal higher than the prior ${window.dayCount} days.`
          : `Calorie average is ${Math.abs(delta)} kcal lower than the prior ${window.dayCount} days.`,
    });
  }

  const dow = dayOfWeekCalorieAverages(window.days, dailyCalories).filter((b) => b.avg > 0);
  if (dow.length >= 3) {
    const sorted = [...dow].sort((a, b) => b.avg - a.avg);
    const highest = sorted[0];
    const weekdayAvg = average(
      dow.filter((b) => b.dayIndex >= 1 && b.dayIndex <= 5).map((b) => b.avg)
    );
    const weekendAvg = average(
      dow.filter((b) => b.dayIndex === 0 || b.dayIndex === 6).map((b) => b.avg)
    );
    if (weekdayAvg > 0 && weekendAvg > 0 && weekendAvg - weekdayAvg >= 200) {
      insights.push({
        id: 'weekend-spike',
        tone: 'warning',
        text: `Weekends average ${Math.round(weekendAvg - weekdayAvg)} kcal more than weekdays.`,
      });
    } else if (highest.avg > avg + 250) {
      insights.push({
        id: 'peak-day',
        tone: 'neutral',
        text: `${highest.label} is your highest-intake day (avg ${highest.avg} kcal).`,
      });
    }
  }

  if (visibleMacroKeys.includes('protein')) {
    const proteinTarget = macroGoalForKey(goals, 'protein');
    const proteinAvg = Math.round(
      average(
        window.days.map((d) => computeDailyTotals(logs, [], d.getTime()).consumedProtein)
      )
    );
    const gap = proteinTarget - proteinAvg;
    if (proteinTarget > 0 && gap >= 15) {
      insights.push({
        id: 'protein-gap',
        tone: 'warning',
        text: `Protein averages ${gap}g below your ${proteinTarget}g target.`,
      });
    }
  }

  const waterSeries = dailyWaterSeries(waterLogs, window.days);
  const waterAvg = Math.round(average(waterSeries));
  if (waterAvg > 0 && waterAvg < hydrationGoal * 0.85) {
    insights.push({
      id: 'hydration-low',
      tone: 'warning',
      text: `Hydration averages ${waterAvg} ml/day — below your ${hydrationGoal} ml goal.`,
    });
  }

  const metHydration = hydrationGoalMetDays(waterSeries, hydrationGoal);
  if (metHydration >= Math.ceil(window.dayCount * 0.7) && window.dayCount >= 3) {
    insights.push({
      id: 'hydration-strong',
      tone: 'positive',
      text: `Hydration goal met on ${metHydration} of ${window.dayCount} days.`,
    });
  }

  const checkIns = supplementCheckInDays(
    supplements,
    window.startOfPeriod,
    window.endOfPeriod
  );
  if (supplements.length > 0 && checkIns > 0) {
    insights.push({
      id: 'supplements',
      tone: checkIns >= Math.ceil(window.dayCount * 0.5) ? 'positive' : 'neutral',
      text: `Supplements logged on ${checkIns} of ${window.dayCount} days.`,
    });
  }

  const streak = computeStreak(logs);
  if (streak >= 3) {
    insights.push({
      id: 'streak',
      tone: 'positive',
      text: `${streak}-day logging streak — keep it going.`,
    });
  }

  const loggedDays = daysWithMealLogs(
    logs,
    window.startOfPeriod,
    window.endOfPeriod
  );
  if (loggedDays < window.dayCount && window.dayCount >= 5) {
    insights.push({
      id: 'logging-gaps',
      tone: 'neutral',
      text: `Meals logged on ${loggedDays} of ${window.dayCount} days in this range.`,
    });
  }

  for (const micro of visibleMicros.slice(0, 2)) {
    const total = sumFieldKeyBetween(
      logs,
      micro.fieldKey,
      window.startOfPeriod,
      window.endOfPeriod
    );
    const avgMicro = total / window.dayCount;
    const target = micro.dailyLimit || 1;
    if (micro.isLimit && avgMicro > target * 1.05) {
      insights.push({
        id: `micro-over-${micro.id}`,
        tone: 'warning',
        text: `${micro.name} averages above your daily limit.`,
      });
    }
  }

  return insights.slice(0, 5);
}
