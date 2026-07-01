import { describe, it, expect } from 'vitest';
import {
  readFoodItemNutrient,
  isDataBackedMicroField,
  canonicalMicroFieldKey,
  copyNutrientFields,
} from './nutrientValue';
import type { FoodItem } from '../types/nutrition';
import { sumFieldKeyBetween } from './dailyTotals';
import type { MealLog } from '../types/nutrition';

const item = (over: Partial<FoodItem>): FoodItem => ({
  id: 'x',
  name: 'Salmon',
  quantity: '1 fillet',
  calories: 200,
  protein: 25,
  carbs: 0,
  fat: 10,
  confidence: 'high',
  ...over,
});

describe('nutrientValue', () => {
  it('reads top-level and micros-map nutrients with alias resolution', () => {
    const salmon = item({ iron: 1.2, micros: { omega3: 1.8, selenium: 32 } });
    expect(readFoodItemNutrient(salmon, 'iron')).toBe(1.2);
    expect(readFoodItemNutrient(salmon, 'omega3')).toBe(1.8);
    expect(readFoodItemNutrient(salmon, 'Omega-3')).toBe(1.8);
    expect(readFoodItemNutrient(salmon, 'selenium')).toBe(32);
    expect(canonicalMicroFieldKey('addedsugar')).toBe('addedSugar');
  });

  it('knows which tracked micro fields are data-backed', () => {
    expect(isDataBackedMicroField('fiber')).toBe(true);
    expect(isDataBackedMicroField('omega3')).toBe(true);
    expect(isDataBackedMicroField('potassium')).toBe(true);
    expect(isDataBackedMicroField('selenium')).toBe(true);
    expect(isDataBackedMicroField('lycopene')).toBe(false);
  });

  it('copies all nutrient fields for favorites / presets', () => {
    const copied = copyNutrientFields(item({ fiber: 4, potassium: 420, micros: { omega3: 0.5 } }));
    expect(copied.fiber).toBe(4);
    expect(copied.potassium).toBe(420);
    expect(copied.micros?.omega3).toBe(0.5);
  });

  it('foodItemFromFavorite restores full nutrient payload for quick re-log', async () => {
    const { foodItemFromFavorite } = await import('./nutrientValue');
    const fav = foodItemFromFavorite({
      name: 'Salmon',
      quantity: '1 fillet',
      calories: 350,
      protein: 40,
      carbs: 0,
      fat: 20,
      iron: 1.1,
      micros: { omega3: 2.4 },
    });
    expect(fav.iron).toBe(1.1);
    expect(fav.micros?.omega3).toBe(2.4);
    expect(fav.confidence).toBe('high');
  });
});

describe('sumFieldKeyBetween micros map', () => {
  it('sums omega-3 from the nested micros object', () => {
    const logs: MealLog[] = [{
      id: 'm1',
      timestamp: new Date(2026, 5, 13, 12).getTime(),
      mealType: 'lunch',
      items: [item({ micros: { omega3: 2.2 } })],
    }];
    const start = new Date(2026, 5, 13).getTime();
    const end = start + 86400000;
    expect(sumFieldKeyBetween(logs, 'omega3', start, end)).toBe(2.2);
  });
});
