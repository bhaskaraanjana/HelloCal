import { describe, it, expect } from 'vitest';
import { localParser } from './localParser';

describe('localParser.parseText (offline fallback)', () => {
  it('always returns a food-typed response with an offline coaching note', () => {
    const res = localParser.parseText('grilled chicken');
    expect(res.type).toBe('food');
    expect(res.coachingMessage.toLowerCase()).toContain('offline');
    expect(res.items && res.items.length).toBeGreaterThan(0);
  });

  it('falls back to a 150 kcal guess for unrecognized input', () => {
    const res = localParser.parseText('zzzqqq nonsense food');
    expect(res.items).toHaveLength(1);
    expect(res.items![0].confidence).toBe('guess');
    expect(res.items![0].calories).toBe(150);
  });

  it('extracts an explicit calorie amount as a guess', () => {
    const res = localParser.parseText('blarg 250 kcal');
    expect(res.items![0].calories).toBe(250);
    expect(res.items![0].confidence).toBe('guess');
  });

  it('marks a count-multiplier estimate (no weight unit) as a guess', () => {
    // "3 eggs" relies on a count multiplier, not a clean weight ratio -> guess.
    const res = localParser.parseText('3 eggs');
    expect(res.items!.every((i) => ['high', 'guess'].includes(i.confidence))).toBe(true);
    const egg = res.items!.find((i) => i.name.toLowerCase().includes('egg'));
    if (egg) expect(egg.confidence).toBe('guess');
  });

  it('never emits negative or NaN calories', () => {
    for (const q of ['', 'apple and rice', '0 kcal snack', 'water']) {
      const res = localParser.parseText(q);
      for (const item of res.items ?? []) {
        expect(Number.isFinite(item.calories)).toBe(true);
        expect(item.calories).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
