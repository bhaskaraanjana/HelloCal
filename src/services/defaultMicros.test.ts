import { describe, it, expect } from 'vitest';
import { buildDefaultMicros, mergeDefaultMicroCatalog, DEFAULT_MICRO_CATALOG } from './defaultMicros';
import type { UserGoals } from '../types/nutrition';

const goals: UserGoals = { calories: 2000, protein: 130, carbs: 220, fat: 65, addedSugar: 30, fiber: 30, sodium: 2300 };

describe('defaultMicros', () => {
  it('seeds omegas and core vitamins/minerals by default', () => {
    const micros = buildDefaultMicros(goals);
    expect(micros.length).toBe(DEFAULT_MICRO_CATALOG.length);
    expect(micros.some((m) => m.fieldKey === 'omega3' && !m.hidden)).toBe(true);
    expect(micros.some((m) => m.fieldKey === 'omega6' && !m.hidden)).toBe(true);
    expect(micros.some((m) => m.fieldKey === 'vitaminD')).toBe(true);
  });

  it('merges missing catalog entries into an existing list', () => {
    const existing = buildDefaultMicros(goals).slice(0, 3);
    const merged = mergeDefaultMicroCatalog(existing);
    expect(merged.length).toBe(DEFAULT_MICRO_CATALOG.length);
    expect(merged.some((m) => m.fieldKey === 'omega3')).toBe(true);
  });
});
