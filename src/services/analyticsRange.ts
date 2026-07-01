import type { MealLog } from '../types/nutrition';

export type AnalyticsPeriod = 7 | 14 | 30 | 90 | 'all';

export const ANALYTICS_PERIOD_OPTIONS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '7D', value: 7 },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: 'All', value: 'all' },
];

export const ANALYTICS_PERIOD_STORAGE_KEY = 'hellocal_analytics_period';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseStoredAnalyticsPeriod(raw: string | null): AnalyticsPeriod {
  if (raw === 'all') return 'all';
  const n = Number(raw);
  if (n === 7 || n === 14 || n === 30 || n === 90) return n;
  return 7;
}

export function serializeAnalyticsPeriod(period: AnalyticsPeriod): string {
  return String(period);
}

function startOfLocalDay(ts: number): Date {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayStart(): Date {
  return startOfLocalDay(Date.now());
}

export function buildDaySeries(start: Date, dayCount: number): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

export interface AnalyticsWindow {
  period: AnalyticsPeriod;
  days: Date[];
  dayCount: number;
  bucketMode: 'daily' | 'weekly';
  rangeLabel: string;
  startOfPeriod: number;
  endOfPeriod: number;
}

function firstLogDay(logs: MealLog[]): Date | null {
  if (logs.length === 0) return null;
  const minTs = Math.min(...logs.map((l) => l.timestamp));
  return startOfLocalDay(minTs);
}

export function resolveAnalyticsWindow(logs: MealLog[], period: AnalyticsPeriod): AnalyticsWindow {
  const endDay = todayStart();
  const endExclusive = endDay.getTime() + MS_PER_DAY;

  let startDay: Date;
  if (period === 'all') {
    const first = firstLogDay(logs);
    startDay = first ?? new Date(endDay.getTime() - 6 * MS_PER_DAY);
  } else {
    startDay = new Date(endDay);
    startDay.setDate(startDay.getDate() - (period - 1));
    startDay.setHours(0, 0, 0, 0);
  }

  const dayCount = Math.max(1, Math.round((endExclusive - startDay.getTime()) / MS_PER_DAY));
  const days = buildDaySeries(startDay, dayCount);
  const bucketMode: 'daily' | 'weekly' =
    period === 90 || (period === 'all' && dayCount > 60) ? 'weekly' : 'daily';

  const rangeEnd = new Date(endDay);
  const rangeLabel = formatAnalyticsRangeLabel(startDay, rangeEnd, dayCount);

  return {
    period,
    days,
    dayCount,
    bucketMode,
    rangeLabel,
    startOfPeriod: startDay.getTime(),
    endOfPeriod: endExclusive,
  };
}

export function formatAnalyticsRangeLabel(start: Date, end: Date, dayCount: number): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const span = dayCount === 1 ? '1 day' : `${dayCount} days`;
  return `${fmt(start)} – ${fmt(end)} · ${span}`;
}

export function formatDayChartLabel(date: Date, dayCount: number): string {
  if (dayCount <= 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatWeekBucketLabel(start: Date, daysInBucket: number): string {
  const short = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  if (daysInBucket <= 1) return short(start);
  const end = new Date(start);
  end.setDate(end.getDate() + daysInBucket - 1);
  return `${short(start)}–${short(end)}`;
}

export interface WeeklySeries {
  labels: string[];
  values: number[];
}

/** Sum daily values into consecutive 7-day buckets (last bucket may be partial). */
export function aggregateWeekly(dates: Date[], dailyValues: number[]): WeeklySeries {
  const labels: string[] = [];
  const values: number[] = [];
  for (let i = 0; i < dates.length; i += 7) {
    const chunkDates = dates.slice(i, i + 7);
    const chunkVals = dailyValues.slice(i, i + 7);
    labels.push(formatWeekBucketLabel(chunkDates[0], chunkDates.length));
    values.push(chunkVals.reduce((sum, v) => sum + v, 0));
  }
  return { labels, values };
}

export function chartSeriesFromDaily(
  window: AnalyticsWindow,
  dailyValues: number[]
): { labels: string[]; values: number[] } {
  if (window.bucketMode === 'weekly') {
    const weekly = aggregateWeekly(window.days, dailyValues);
    return { labels: weekly.labels, values: weekly.values };
  }
  return {
    labels: window.days.map((d) => formatDayChartLabel(d, window.dayCount)),
    values: dailyValues,
  };
}
