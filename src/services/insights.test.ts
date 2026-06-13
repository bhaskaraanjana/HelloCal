import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeStreak, totalLoggedDays, dayRange, isSameLocalDay } from './insights';
import type { MealLog } from '../types/nutrition';

const DAY = 86400000;

// Fix "now" to local noon so day-boundary math is deterministic.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-13T12:00:00'));
});
afterEach(() => vi.useRealTimers());

const mealAt = (ts: number): MealLog => ({ id: `m${ts}`, timestamp: ts, mealType: 'snack', items: [] });

describe('computeStreak', () => {
  it('returns 0 for no logs', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const now = Date.now();
    expect(computeStreak([mealAt(now), mealAt(now - DAY), mealAt(now - 2 * DAY)])).toBe(3);
  });

  it('gives a grace day: logged yesterday but not today still counts', () => {
    const now = Date.now();
    expect(computeStreak([mealAt(now - DAY), mealAt(now - 2 * DAY)])).toBe(2);
  });

  it('breaks the streak when both today and yesterday are missing', () => {
    const now = Date.now();
    expect(computeStreak([mealAt(now - 3 * DAY)])).toBe(0);
  });

  it('stops counting at a gap', () => {
    const now = Date.now();
    // today, yesterday, then a gap (skip 2 days ago), then 3 days ago
    expect(computeStreak([mealAt(now), mealAt(now - DAY), mealAt(now - 3 * DAY)])).toBe(2);
  });
});

describe('totalLoggedDays', () => {
  it('counts distinct local days regardless of multiple logs per day', () => {
    const now = Date.now();
    const logs = [mealAt(now), mealAt(now - 1000), mealAt(now - DAY)];
    expect(totalLoggedDays(logs)).toBe(2);
  });
});

describe('dayRange', () => {
  it('produces a half-open 24h window containing now', () => {
    const now = Date.now();
    const { start, end } = dayRange(now);
    expect(start).toBeLessThanOrEqual(now);
    expect(end).toBeGreaterThan(now);
    expect(end - start).toBe(DAY);
  });
});

describe('isSameLocalDay', () => {
  it('is true within a day and false across days', () => {
    const now = Date.now();
    expect(isSameLocalDay(now, now - 1000)).toBe(true);
    expect(isSameLocalDay(now, now - DAY)).toBe(false);
  });
});
