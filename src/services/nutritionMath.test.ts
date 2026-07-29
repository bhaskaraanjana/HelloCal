import { describe, it, expect } from 'vitest';
import { calcBMR, calcTDEE, deriveGoals, kgToLb, lbToKg, cmToFeetInches, feetInchesToCm, updateNutrientGoals } from './nutritionMath';
import type { UserProfile } from '../types/nutrition';

describe('weight conversions', () => {
  it('round-trips kg <-> lb', () => {
    expect(lbToKg(kgToLb(80))).toBeCloseTo(80, 6);
  });
});

describe('height conversions', () => {
  it('converts 180 cm to 5 ft 11 in', () => {
    expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 11 });
  });
  it('round-trips feet/inches to cm', () => {
    expect(feetInchesToCm(5, 11)).toBeCloseTo(180, 0);
  });
});

describe('calcBMR (Mifflin–St Jeor)', () => {
  it('matches the known male formula', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calcBMR('male', 80, 180, 30)).toBe(1780);
  });
  it('applies the female offset', () => {
    // base = 800 + 1125 - 150 = 1775; female = base - 161 = 1614
    expect(calcBMR('female', 80, 180, 30)).toBe(1614);
  });
});

describe('calcTDEE', () => {
  it('returns null on an incomplete profile', () => {
    expect(calcTDEE({ sex: 'male', weightKg: 80 })).toBeNull();
  });
  it('multiplies BMR by the activity factor', () => {
    const p: UserProfile = { sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityLevel: 'sedentary' };
    expect(calcTDEE(p)).toBe(Math.round(1780 * 1.2));
  });
});

describe('deriveGoals', () => {
  const base: UserProfile = {
    sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityLevel: 'moderate', goalDirection: 'maintain',
  };

  it('returns null when profile is incomplete', () => {
    expect(deriveGoals({ sex: 'male' })).toBeNull();
  });

  it('applies a 500 kcal deficit for weight loss', () => {
    const maintain = deriveGoals(base)!;
    const lose = deriveGoals({ ...base, goalDirection: 'lose' })!;
    expect(maintain.calories - lose.calories).toBe(500);
  });

  it('sets protein to ~1.8 g/kg', () => {
    expect(deriveGoals(base)!.protein).toBe(Math.round(80 * 1.8));
  });

  it('keeps macros internally consistent (carbs fill the remainder, non-negative)', () => {
    const g = deriveGoals(base)!;
    expect(g.carbs).toBeGreaterThanOrEqual(0);
    const macroKcal = g.protein * 4 + g.carbs * 4 + g.fat * 9;
    // Within rounding of the calorie target.
    expect(Math.abs(macroKcal - g.calories)).toBeLessThan(30);
  });

  it('never goes below the 1200 kcal floor', () => {
    const tiny: UserProfile = { sex: 'female', weightKg: 40, heightCm: 150, age: 70, activityLevel: 'sedentary', goalDirection: 'lose' };
    expect(deriveGoals(tiny)!.calories).toBeGreaterThanOrEqual(1200);
  });

  it('keeps macro kcal <= the calorie budget for a heavy user hitting the 1200 floor', () => {
    // High protein target (130kg*1.8=234g=936kcal) + 25% fat would overshoot a deeply
    // floored budget and drive carbs negative -> clamped to 0 while macros > calories.
    const heavy: UserProfile = { sex: 'female', weightKg: 130, heightCm: 150, age: 70, activityLevel: 'sedentary', goalDirection: 'lose' };
    const g = deriveGoals(heavy)!;
    expect(g.carbs).toBeGreaterThanOrEqual(0);
    const macroKcal = g.protein * 4 + g.carbs * 4 + g.fat * 9;
    expect(macroKcal).toBeLessThanOrEqual(g.calories + 10); // within rounding
  });
});

describe('updateNutrientGoals', () => {
  it('correctly updates macro limits when calorie target is changed', () => {
    const current = { calories: 2000, protein: 130, carbs: 220, fat: 65, fiber: 30 };
    const next = updateNutrientGoals(1600, current);
    expect(next.calories).toBe(1600);
    expect(next.protein).toBe(130);
    expect(next.fiber).toBe(25); // calories < 2000 -> 25g fiber
    expect(next.fat).toBe(Math.round((1600 * 0.25) / 9)); // 44g fat
    // Carbs should fill the rest
    const macroKcal = next.protein * 4 + next.carbs * 4 + next.fat * 9;
    expect(Math.abs(macroKcal - 1600)).toBeLessThan(15);
  });
});
