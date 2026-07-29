import type { ActivityLevel, GoalDirection, Sex, UserGoals, UserProfile } from '../types/nutrition';

export const LB_PER_KG = 2.2046226218;

export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const lbToKg = (lb: number): number => lb / LB_PER_KG;

export const CM_PER_IN = 2.54;

export const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
  const totalIn = cm / CM_PER_IN;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn % 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
};

export const feetInchesToCm = (feet: number, inches: number): number =>
  (feet * 12 + inches) * CM_PER_IN;

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little/no exercise)',
  light: 'Light (1–3 days/week)',
  moderate: 'Moderate (3–5 days/week)',
  active: 'Active (6–7 days/week)',
  veryActive: 'Very active (athlete / physical job)',
};

export const GOAL_LABELS: Record<GoalDirection, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain weight',
  gain: 'Gain weight / muscle',
};

/** Mifflin–St Jeor Basal Metabolic Rate (kcal/day). */
export function calcBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Total Daily Energy Expenditure (kcal/day). */
export function calcTDEE(profile: UserProfile): number | null {
  const { sex, weightKg, heightCm, age, activityLevel } = profile;
  if (!sex || !weightKg || !heightCm || !age || !activityLevel) return null;
  const bmr = calcBMR(sex, weightKg, heightCm, age);
  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);
}

/**
 * Derive a full set of daily nutrition goals from a profile.
 * Calorie adjustment: -500 (lose) / 0 (maintain) / +300 (gain).
 * Macros: protein 1.8 g/kg, fat 25% of kcal, carbs fill the remainder.
 */
export function deriveGoals(profile: UserProfile): UserGoals | null {
  const tdee = calcTDEE(profile);
  if (tdee == null || !profile.weightKg) return null;

  const adjust =
    profile.goalDirection === 'lose' ? -500 : profile.goalDirection === 'gain' ? 300 : 0;
  const calories = Math.max(1200, Math.round((tdee + adjust) / 10) * 10);

  const protein = Math.round(profile.weightKg * 1.8);
  const proteinCals = protein * 4;
  // Fat = 25% of kcal, BUT cap it so protein+fat kcal can't exceed the (possibly
  // 1200-floored) calorie budget — otherwise carbs clamps to 0 while the macro kcal
  // overshoots the stated goal (heavy user on a deep deficit hitting the floor).
  let fat = Math.round((calories * 0.25) / 9);
  if (proteinCals + fat * 9 > calories) {
    fat = Math.max(0, Math.round((calories - proteinCals) / 9));
  }
  const fatCals = fat * 9;
  const carbs = Math.max(0, Math.round((calories - proteinCals - fatCals) / 4));

  // Water heuristic: ~35 ml per kg body weight, rounded to nearest 100 ml.
  const waterTarget = Math.round((profile.weightKg * 35) / 100) * 100;

  return {
    calories,
    protein,
    carbs,
    fat,
    addedSugar: 30,
    fiber: calories >= 2000 ? 38 : 25,
    sodium: 2300,
    waterTarget,
  };
}

export function updateNutrientGoals(calories: number, currentGoals: UserGoals, profile?: UserProfile): UserGoals {
  const protein = (profile && profile.weightKg && profile.weightKg > 0)
    ? Math.round(profile.weightKg * 1.8)
    : (currentGoals.protein || 130);
  const proteinCals = protein * 4;
  let fat = Math.round((calories * 0.25) / 9);
  if (proteinCals + fat * 9 > calories) {
    fat = Math.max(0, Math.round((calories - proteinCals) / 9));
  }
  const fatCals = fat * 9;
  const carbs = Math.max(0, Math.round((calories - proteinCals - fatCals) / 4));
  const fiber = calories >= 2000 ? 38 : 25;

  return {
    ...currentGoals,
    calories,
    protein,
    carbs,
    fat,
    fiber,
  };
}
