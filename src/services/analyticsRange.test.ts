import { describe, it, expect } from 'vitest';
import {
  aggregateWeekly,
  parseStoredAnalyticsPeriod,
  resolveAnalyticsWindow,
  buildDaySeries,
} from './analyticsRange';
import type { MealLog } from '../types/nutrition';

const logAt = (daysAgo: number): MealLog => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return {
    id: `m-${daysAgo}`,
    timestamp: d.getTime(),
    mealType: 'lunch',
    items: [{ id: 'i', name: 'Food', quantity: '1', calories: 100, protein: 0, carbs: 0, fat: 0, confidence: 'high' }],
  };
};

describe('parseStoredAnalyticsPeriod', () => {
  it('parses known presets', () => {
    expect(parseStoredAnalyticsPeriod('7')).toBe(7);
    expect(parseStoredAnalyticsPeriod('90')).toBe(90);
    expect(parseStoredAnalyticsPeriod('all')).toBe('all');
  });
  it('falls back to 7 days', () => {
    expect(parseStoredAnalyticsPeriod('38')).toBe(7);
    expect(parseStoredAnalyticsPeriod(null)).toBe(7);
  });
});

describe('resolveAnalyticsWindow', () => {
  it('builds a 7-day window', () => {
    const w = resolveAnalyticsWindow([], 7);
    expect(w.dayCount).toBe(7);
    expect(w.bucketMode).toBe('daily');
  });

  it('uses weekly buckets for 90 days', () => {
    const w = resolveAnalyticsWindow([], 90);
    expect(w.dayCount).toBe(90);
    expect(w.bucketMode).toBe('weekly');
  });

  it('all-time starts at first log when short history stays daily', () => {
    const logs = [logAt(10), logAt(5)];
    const w = resolveAnalyticsWindow(logs, 'all');
    expect(w.dayCount).toBe(11);
    expect(w.bucketMode).toBe('daily');
  });

  it('all-time uses weekly buckets beyond 60 days', () => {
    const logs = [logAt(70)];
    const w = resolveAnalyticsWindow(logs, 'all');
    expect(w.dayCount).toBeGreaterThan(60);
    expect(w.bucketMode).toBe('weekly');
  });
});

describe('aggregateWeekly', () => {
  it('sums values into 7-day chunks', () => {
    const days = buildDaySeries(new Date(2026, 5, 1), 10);
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const { labels, values } = aggregateWeekly(days, vals);
    expect(labels).toHaveLength(2);
    expect(values[0]).toBe(28);
    expect(values[1]).toBe(27);
  });
});
