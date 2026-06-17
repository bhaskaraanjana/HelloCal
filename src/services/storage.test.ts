import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storage } from './storage';

function makeLocalStorage(overrides: Partial<Storage> = {}): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    ...overrides,
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorage());
  storage.setErrorHandler(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('storage round-trips', () => {
  it('saves and loads logs (through sanitization)', () => {
    storage.saveLogs([{ id: 'm1', timestamp: 100, mealType: 'lunch', items: [{ id: 'i1', name: 'Soup', quantity: '1', calories: 120, protein: 5, carbs: 10, fat: 3, confidence: 'high' }] }]);
    const data = storage.getData();
    expect(data.logs).toHaveLength(1);
    expect(data.logs[0].items[0].name).toBe('Soup');
  });

  it('round-trips the Gemini key via base64', () => {
    storage.saveGeminiKey('secret-key-123');
    expect(storage.getData().geminiKey).toBe('secret-key-123');
  });

  it('returns defaults for a brand-new store', () => {
    const data = storage.getData();
    expect(data.logs).toEqual([]);
    expect(data.goals.calories).toBe(2000);
    expect(data.coachPersonality).toBe('encouraging');
  });
});

describe('getData defensive load', () => {
  it('sanitizes corrupt logs rather than surfacing them', () => {
    // A log whose only item has no name -> item dropped -> log dropped.
    localStorage.setItem('hellocal_logs', JSON.stringify([{ id: 'm1', mealType: 'lunch', items: [{ calories: 50 }] }]));
    expect(storage.getData().logs).toEqual([]);
  });

  it('coerces a non-finite calorie to 0 on load', () => {
    localStorage.setItem('hellocal_logs', JSON.stringify([{ id: 'm1', mealType: 'lunch', timestamp: 1, items: [{ name: 'X', calories: null }] }]));
    const logs = storage.getData().logs;
    expect(logs[0].items[0].calories).toBe(0);
  });

  it('survives malformed JSON in a collection key', () => {
    localStorage.setItem('hellocal_logs', '{not valid json');
    expect(() => storage.getData()).not.toThrow();
    expect(storage.getData().logs).toEqual([]);
  });

  it('tolerates a corrupt base64 key', () => {
    localStorage.setItem('hellocal_gemini_key', '!!!not-base64!!!');
    expect(() => storage.getData()).not.toThrow();
  });
});

describe('migration backfill', () => {
  it('backfills missing goal fields from defaults', () => {
    localStorage.setItem('hellocal_goals', JSON.stringify({ calories: 1800, protein: 120, carbs: 200, fat: 60 }));
    const goals = storage.getData().goals;
    expect(goals.addedSugar).toBeDefined();
    expect(goals.fiber).toBeDefined();
    expect(goals.sodium).toBeDefined();
    expect(goals.waterTarget).toBeDefined();
  });

  it('backfills the reminders default for older settings', () => {
    localStorage.setItem('hellocal_app_settings', JSON.stringify({ theme: 'ocean', visibleMacros: {}, visibleMicros: {}, visibleWidgets: {} }));
    const s = storage.getData().appSettings!;
    expect(s.reminders).toBeDefined();
    expect(s.reminders!.enabled).toBe(false);
    expect(s.reminders!.snack).toBe('16:00');
    expect(s.supplementReminders).toBeDefined();
    expect(s.supplementReminders!.enabled).toBe(false);
    expect(s.theme).toBe('ocean');
  });

  it('migrate() stamps the schema version', () => {
    storage.migrate();
    expect(localStorage.getItem('hellocal_schema_version')).toBe('3');
  });

  it('migrate() carries legacy halocal_* data forward to hellocal_* (rebrand)', () => {
    localStorage.setItem('halocal_logs', JSON.stringify([{ id: 'm1', timestamp: 1, mealType: 'lunch', items: [{ id: 'i', name: 'Soup', quantity: '1', calories: 120, protein: 5, carbs: 10, fat: 3, confidence: 'high' }] }]));
    localStorage.setItem('halocal_goals', JSON.stringify({ calories: 1900, protein: 120, carbs: 200, fat: 60 }));
    storage.migrate();
    expect(localStorage.getItem('hellocal_logs')).toBeTruthy();
    const data = storage.getData();
    expect(data.logs).toHaveLength(1);
    expect(data.goals.calories).toBe(1900);
  });

  it('migrate() does not overwrite existing hellocal_* data with legacy', () => {
    localStorage.setItem('halocal_goals', JSON.stringify({ calories: 1500, protein: 1, carbs: 1, fat: 1 }));
    localStorage.setItem('hellocal_goals', JSON.stringify({ calories: 2200, protein: 1, carbs: 1, fat: 1 }));
    storage.migrate();
    expect(storage.getData().goals.calories).toBe(2200);
  });

  it('migrate() still stamps the version when settings JSON is corrupt (no infinite re-migration)', () => {
    localStorage.setItem('hellocal_schema_version', '2');
    localStorage.setItem('hellocal_app_settings', '{bad json');
    expect(() => storage.migrate()).not.toThrow();
    expect(localStorage.getItem('hellocal_schema_version')).toBe('3');
  });
});

describe('clearAll wipes data permanently (no resurrection)', () => {
  it('removes legacy halocal_* keys and re-stamps the version so migrate() cannot resurrect data', () => {
    // A user who was migrated from HaloCal still has legacy keys on disk.
    localStorage.setItem('halocal_logs', JSON.stringify([{ id: 'm1', timestamp: 1, mealType: 'lunch', items: [{ id: 'i', name: 'Soup', quantity: '1', calories: 120, protein: 5, carbs: 10, fat: 3, confidence: 'high' }] }]));
    storage.migrate(); // copies legacy -> hellocal_*, stamps version 3
    expect(storage.getData().logs).toHaveLength(1);

    storage.clearAll();
    expect(localStorage.getItem('halocal_logs')).toBeNull();
    expect(localStorage.getItem('hellocal_logs')).toBeNull();
    expect(localStorage.getItem('hellocal_schema_version')).toBe('3');

    // Simulate the next app mount: migrate() must be a no-op, not a resurrection.
    storage.migrate();
    expect(storage.getData().logs).toEqual([]);
  });
});

describe('getData coerces corrupt goals/settings', () => {
  it('coerces NaN/null/string goal values to finite, in-bounds numbers', () => {
    localStorage.setItem('hellocal_goals', JSON.stringify({ calories: null, protein: 'abc', carbs: 200, fat: 60 }));
    const goals = storage.getData().goals;
    expect(Number.isFinite(goals.calories)).toBe(true);
    expect(goals.calories).toBe(2000); // null -> default
    expect(Number.isFinite(goals.protein)).toBe(true);
    expect(goals.protein).toBe(130); // 'abc' -> default
    expect(goals.carbs).toBe(200); // valid value preserved
  });

  it('clamps an absurd goal to its bound', () => {
    localStorage.setItem('hellocal_goals', JSON.stringify({ calories: 999999 }));
    expect(storage.getData().goals.calories).toBe(6000); // GOAL_BOUNDS.calories.max
  });

  it('falls back to default settings when the stored value is an array', () => {
    localStorage.setItem('hellocal_app_settings', '[]');
    const s = storage.getData().appSettings!;
    expect(s.theme).toBe('obsidian');
    expect(s.visibleWidgets).toBeDefined();
  });
});

describe('quota / write failures', () => {
  it('routes a QuotaExceededError to the error handler instead of throwing', () => {
    const onError = vi.fn();
    const throwing = makeLocalStorage({
      setItem: () => { const e: Error & { name: string } = new Error('quota') as never; e.name = 'QuotaExceededError'; throw e; },
    });
    vi.stubGlobal('localStorage', throwing);
    storage.setErrorHandler(onError);
    expect(() => storage.saveLogs([])).not.toThrow();
    expect(onError).toHaveBeenCalled();
  });
});
