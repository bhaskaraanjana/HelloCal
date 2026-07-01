import { describe, it, expect } from 'vitest';
import {
  sanitizeMealLogs,
  sanitizeWorkouts,
  sanitizeFavorites,
  sanitizeMealTemplates,
  sanitizeWaterLogs,
  sanitizeBodyMetrics,
  sanitizeCustomMicros,
  canonicalMicroUnit,
} from './sanitize';

describe('sanitizeCustomMicros', () => {
  it('heals a legacy lowercase backed fieldKey to camelCase', () => {
    const [m] = sanitizeCustomMicros([{ id: 'x', name: 'Added Sugar', fieldKey: 'addedsugar', unit: 'g', dailyLimit: 30 }]);
    expect(m.fieldKey).toBe('addedSugar');
  });

  it('forces the canonical unit when healing makes a micro data-backed (no g/mg mismatch)', () => {
    // A legacy micro stored with a non-canonical unit must be corrected so the HUD,
    // which sums the raw gram value, does not mislabel it.
    const [m] = sanitizeCustomMicros([{ id: 'x', name: 'Added Sugar', fieldKey: 'addedsugar', unit: 'mg', dailyLimit: 30 }]);
    expect(m.fieldKey).toBe('addedSugar');
    expect(m.unit).toBe('g');
  });

  it('leaves a non-backed custom micro unit untouched', () => {
    const [m] = sanitizeCustomMicros([{ id: 'x', name: 'Potassium', fieldKey: 'potassium', unit: 'mg', dailyLimit: 3500 }]);
    expect(m.fieldKey).toBe('potassium');
    expect(m.unit).toBe('mg');
  });

  it('canonicalMicroUnit: mg for sodium/iron/potassium/calcium etc, g for other backed fields, null otherwise', () => {
    expect(canonicalMicroUnit('sodium')).toBe('mg');
    expect(canonicalMicroUnit('iron')).toBe('mg');
    expect(canonicalMicroUnit('potassium')).toBe('mg');
    expect(canonicalMicroUnit('addedSugar')).toBe('g');
    expect(canonicalMicroUnit('omega3')).toBe('g');
    expect(canonicalMicroUnit('selenium')).toBeNull();
  });

  it('DATA_BACKED_MICRO_FIELDS rejects unknown custom nutrients', async () => {
    const { DATA_BACKED_MICRO_FIELDS } = await import('./sanitize');
    expect(DATA_BACKED_MICRO_FIELDS.has('fiber')).toBe(true);
    expect(DATA_BACKED_MICRO_FIELDS.has('omega3')).toBe(true);
    expect(DATA_BACKED_MICRO_FIELDS.has('lycopene')).toBe(false);
  });
});

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

  it('keeps optional micros and nested micros map when present', () => {
    const out = sanitizeFavorites([{
      name: 'Yogurt',
      calories: 100,
      protein: 10,
      carbs: 8,
      fat: 2,
      addedSugar: 6,
      iron: 0.4,
      micros: { omega3: 0.2 },
    }]);
    expect(out[0].addedSugar).toBe(6);
    expect(out[0].iron).toBe(0.4);
    expect(out[0].micros?.omega3).toBe(0.2);
    expect(out[0].fiber).toBeUndefined();
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

describe('sanitizeWaterLogs', () => {
  it('drops rows with no positive volume and coerces the rest', () => {
    const out = sanitizeWaterLogs([
      { id: 'w1', timestamp: 100, milliliters: 250 },
      { milliliters: 0 },
      { milliliters: -5 },
      { milliliters: 'x' },
      null,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].milliliters).toBe(250);
    expect(out[0].timestamp).toBe(100);
  });
  it('preserves an epoch-0-adjacent valid timestamp without forcing now (uses || only for 0)', () => {
    const out = sanitizeWaterLogs([{ milliliters: 200, timestamp: 1700000000000 }]);
    expect(out[0].timestamp).toBe(1700000000000);
  });
});

describe('sanitizeBodyMetrics', () => {
  it('drops weightless rows, defaults unit, coerces optionals', () => {
    const out = sanitizeBodyMetrics([
      { id: 'b1', timestamp: 50, weight: 80, unit: 'lb', bodyFat: 18 },
      { weight: 0 },
      { weight: -10 },
      { weight: 70 }, // no unit -> defaults kg
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].weight).toBe(80);
    expect(out[0].unit).toBe('lb');
    expect(out[0].bodyFat).toBe(18);
    expect(out[1].unit).toBe('kg');
    expect(out[1].waist).toBeUndefined();
  });
  it('returns [] for non-arrays', () => {
    expect(sanitizeBodyMetrics(null)).toEqual([]);
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
