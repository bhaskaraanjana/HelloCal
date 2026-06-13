import { describe, it, expect } from 'vitest';
import { scaleNutrients, autoMealSlot } from './logMath';

describe('scaleNutrients', () => {
  it('scales numeric nutrients, rounding calories/sodium to integers', () => {
    const out = scaleNutrients(
      { name: 'Yogurt', id: 'x', quantity: '1', calories: 101, protein: 10.4, carbs: 5, fat: 2, sodium: 55, confidence: 'high' },
      2
    );
    expect(out.calories).toBe(202);
    expect(out.sodium).toBe(110);
    expect(out.protein).toBe(20.8);
  });

  it('keeps one decimal for macros', () => {
    const out = scaleNutrients({ calories: 100, protein: 3, carbs: 0, fat: 0 }, 1.5);
    expect(out.protein).toBe(4.5);
  });

  it('preserves id and non-numeric fields untouched', () => {
    const out = scaleNutrients({ id: 'keep', name: 'Egg', quantity: '1 large', calories: 78, confidence: 'high' }, 3);
    expect(out.id).toBe('keep');
    expect(out.name).toBe('Egg');
    expect(out.quantity).toBe('1 large');
    expect(out.confidence).toBe('high');
    expect(out.calories).toBe(234);
  });

  it('leaves absent optional fields absent', () => {
    const out = scaleNutrients({ calories: 50, protein: 1, carbs: 1, fat: 1 }, 2) as Record<string, unknown>;
    expect('sodium' in out).toBe(false);
    expect('fiber' in out).toBe(false);
  });

  it('does not mutate the input', () => {
    const input = { calories: 100, protein: 5, carbs: 0, fat: 0 };
    scaleNutrients(input, 2);
    expect(input.calories).toBe(100);
  });

  it('scaling by 0 zeroes nutrients', () => {
    const out = scaleNutrients({ calories: 100, protein: 5, carbs: 10, fat: 2 }, 0);
    expect(out.calories).toBe(0);
    expect(out.protein).toBe(0);
  });
});

describe('autoMealSlot', () => {
  const at = (h: number) => new Date(2026, 0, 1, h, 0, 0);
  it('maps morning hours to breakfast', () => {
    expect(autoMealSlot(at(4))).toBe('breakfast');
    expect(autoMealSlot(at(10))).toBe('breakfast');
  });
  it('maps midday to lunch', () => {
    expect(autoMealSlot(at(11))).toBe('lunch');
    expect(autoMealSlot(at(15))).toBe('lunch');
  });
  it('maps evening to dinner', () => {
    expect(autoMealSlot(at(17))).toBe('dinner');
    expect(autoMealSlot(at(21))).toBe('dinner');
  });
  it('maps late-night / mid-afternoon gap to snack', () => {
    expect(autoMealSlot(at(2))).toBe('snack');   // 2am
    expect(autoMealSlot(at(16))).toBe('snack');  // 4pm gap
    expect(autoMealSlot(at(22))).toBe('snack');  // 10pm
    expect(autoMealSlot(at(23))).toBe('snack');
  });
});
