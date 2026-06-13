import { describe, it, expect } from 'vitest';
import {
  sanitizeMealLogs,
  sanitizeWorkouts,
  sanitizeFavorites,
  sanitizeMealTemplates,
} from './sanitize';

describe('sanitizeMealLogs', () => {
  it('returns [] for non-arrays / junk', () => {
    expect(sanitizeMealLogs(null)).toEqual([]);
    expect(sanitizeMealLogs('nope')).toEqual([]);
    expect(sanitizeMealLogs({})).toEqual([]);
    expect(sanitizeMealLogs(undefined)).toEqual([]);
  });

  it('drops logs with no valid items', () => {
    expect(sanitizeMealLogs([{ id: 'm1', items: [] }])).toEqual([]);
    expect(sanitizeMealLogs([{ id: 'm1', items: [{ calories: 100 }] }])).toEqual([]); // nameless item
  });

  it('coerces NaN/garbage item numbers to 0 and keeps the row', () => {
    const out = sanitizeMealLogs([
      { id: 'm1', timestamp: 123, mealType: 'lunch', items: [{ name: 'Soup', calories: 'abc', protein: NaN }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].items[0].calories).toBe(0);
    expect(out[0].items[0].protein).toBe(0);
    expect(out[0].mealType).toBe('lunch');
    expect(out[0].timestamp).toBe(123);
  });

  it('defaults an invalid mealType to snack and backfills a missing id', () => {
    const out = sanitizeMealLogs([{ mealType: 'brunch', items: [{ name: 'Egg', calories: 78 }] }]);
    expect(out[0].mealType).toBe('snack');
    expect(typeof out[0].id).toBe('string');
    expect(out[0].id.length).toBeGreaterThan(0);
  });

  it('regenerates IDs for items missing them, preserves existing item ids', () => {
    const out = sanitizeMealLogs([
      { id: 'm1', items: [{ id: 'keep', name: 'A', calories: 10 }, { name: 'B', calories: 20 }] },
    ]);
    expect(out[0].items[0].id).toBe('keep');
    expect(typeof out[0].items[1].id).toBe('string');
    expect(out[0].items[1].id.length).toBeGreaterThan(0);
  });
});

describe('sanitizeWorkouts', () => {
  it('drops nameless or invalid rows, coerces numbers', () => {
    const out = sanitizeWorkouts([
      { activity: '  Running  ', duration: '30', caloriesBurned: -5, timestamp: 50 },
      { activity: '' },
      null,
      42,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].activity).toBe('Running');
    expect(out[0].duration).toBe(30);
    expect(out[0].caloriesBurned).toBe(0); // negative clamped
    expect(out[0].timestamp).toBe(50);
  });

  it('returns [] for non-arrays', () => {
    expect(sanitizeWorkouts(null)).toEqual([]);
  });
});

describe('sanitizeFavorites', () => {
  it('drops nameless rows and floors frequency at 1', () => {
    const out = sanitizeFavorites([
      { name: 'Banana', calories: 105, frequency: 0 },
      { calories: 50 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].frequency).toBeGreaterThanOrEqual(1);
    expect(out[0].calories).toBe(105);
  });

  it('keeps optional micros only when present and coerces them', () => {
    const out = sanitizeFavorites([{ name: 'Yogurt', calories: 100, sodium: 'x', addedSugar: 6 }]);
    expect(out[0].sodium).toBe(0); // present-but-garbage -> 0
    expect(out[0].addedSugar).toBe(6);
    expect(out[0].fiber).toBeUndefined(); // absent -> stays undefined
  });

  it('normalizes pinned to boolean|undefined', () => {
    const out = sanitizeFavorites([
      { name: 'A', calories: 1, pinned: true },
      { name: 'B', calories: 1, pinned: 'yes' },
    ]);
    expect(out[0].pinned).toBe(true);
    expect(out[1].pinned).toBeUndefined();
  });
});

describe('sanitizeMealTemplates', () => {
  it('drops templates with no name or no valid items', () => {
    expect(sanitizeMealTemplates([{ name: '', items: [{ name: 'X', calories: 1 }] }])).toEqual([]);
    expect(sanitizeMealTemplates([{ name: 'Lunch', items: [] }])).toEqual([]);
  });

  it('keeps a valid template and stamps createdAt', () => {
    const out = sanitizeMealTemplates([{ id: 't1', name: 'My Lunch', items: [{ name: 'Wrap', calories: 350 }], createdAt: 999 }]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('My Lunch');
    expect(out[0].createdAt).toBe(999);
    expect(out[0].items[0].calories).toBe(350);
  });
});
