import type { MealLog } from '../types/nutrition';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * The local-day window [start, end) containing `ts` (defaults to now). Use the
 * half-open range for all "today" filters so late-night entries from other days
 * never leak across the boundary (e.g. `t >= start && t < end`).
 */
export function dayRange(ts: number = Date.now()): { start: number; end: number } {
  const start = startOfDay(ts);
  return { start, end: start + DAY_MS };
}

/** True when two timestamps fall on the same local calendar day. */
export function isSameLocalDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/**
 * Current logging streak: number of consecutive days (ending today or yesterday)
 * that have at least one meal logged. Today not yet logged does not break the streak
 * until a full day with no logs passes.
 */
export function computeStreak(logs: MealLog[]): number {
  if (logs.length === 0) return 0;

  const loggedDays = new Set(logs.map((l) => startOfDay(l.timestamp)));
  const today = startOfDay(Date.now());

  // Start counting from today if logged, otherwise from yesterday (grace for "not yet today").
  let cursor = loggedDays.has(today) ? today : today - DAY_MS;
  if (!loggedDays.has(cursor)) return 0;

  let streak = 0;
  while (loggedDays.has(cursor)) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}

/** Number of distinct days that have any logged meal (for lifetime stats). */
export function totalLoggedDays(logs: MealLog[]): number {
  return new Set(logs.map((l) => startOfDay(l.timestamp))).size;
}
