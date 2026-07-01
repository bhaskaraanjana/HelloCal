import type { CustomMicro, UserGoals } from '../types/nutrition';

/**
 * Evidence-based daily reference values (FDA Daily Values / NIH DRI, rounded for UX).
 * Omegas live in FoodItem.micros (omega3, omega6) — the parser estimates them for
 * fish, nuts, seeds, and oils; top-level fields are used when present on FoodItem.
 */
export const DEFAULT_MICRO_CATALOG: Omit<CustomMicro, 'hidden'>[] = [
  { id: 'micro_addedsugar', name: 'Added Sugar', emoji: '🍭', unit: 'g', dailyLimit: 50, isLimit: true, color: 'var(--accent-rose)', glowColor: 'var(--accent-rose-glow)', fieldKey: 'addedSugar' },
  { id: 'micro_fiber', name: 'Dietary Fiber', emoji: '🌿', unit: 'g', dailyLimit: 28, isLimit: false, color: 'var(--accent-teal)', glowColor: 'var(--accent-teal-glow)', fieldKey: 'fiber' },
  { id: 'micro_sodium', name: 'Sodium', emoji: '🧂', unit: 'mg', dailyLimit: 2300, isLimit: true, color: 'var(--accent-amber)', glowColor: 'var(--accent-amber-glow)', fieldKey: 'sodium' },
  { id: 'micro_omega3', name: 'Omega-3', emoji: '🐟', unit: 'g', dailyLimit: 1.6, isLimit: false, color: 'var(--accent-blue)', glowColor: 'var(--accent-blue-glow)', fieldKey: 'omega3' },
  { id: 'micro_omega6', name: 'Omega-6', emoji: '🌻', unit: 'g', dailyLimit: 17, isLimit: false, color: 'var(--accent-amber)', glowColor: 'var(--accent-amber-glow)', fieldKey: 'omega6' },
  { id: 'micro_iron', name: 'Iron', emoji: '🩸', unit: 'mg', dailyLimit: 18, isLimit: false, color: 'var(--accent-rose)', glowColor: 'var(--accent-rose-glow)', fieldKey: 'iron' },
  { id: 'micro_calcium', name: 'Calcium', emoji: '🦴', unit: 'mg', dailyLimit: 1000, isLimit: false, color: 'var(--accent-blue)', glowColor: 'var(--accent-blue-glow)', fieldKey: 'calcium' },
  { id: 'micro_vitamind', name: 'Vitamin D', emoji: '☀️', unit: 'mcg', dailyLimit: 20, isLimit: false, color: 'var(--accent-amber)', glowColor: 'var(--accent-amber-glow)', fieldKey: 'vitaminD' },
  { id: 'micro_potassium', name: 'Potassium', emoji: '🍌', unit: 'mg', dailyLimit: 4700, isLimit: false, color: 'var(--accent-purple)', glowColor: 'var(--accent-purple-glow)', fieldKey: 'potassium' },
  { id: 'micro_magnesium', name: 'Magnesium', emoji: '💎', unit: 'mg', dailyLimit: 420, isLimit: false, color: 'var(--accent-teal)', glowColor: 'var(--accent-teal-glow)', fieldKey: 'magnesium' },
  { id: 'micro_vitaminc', name: 'Vitamin C', emoji: '🍊', unit: 'mg', dailyLimit: 90, isLimit: false, color: 'var(--accent-amber)', glowColor: 'var(--accent-amber-glow)', fieldKey: 'vitaminC' },
  { id: 'micro_cholesterol', name: 'Cholesterol', emoji: '🥚', unit: 'mg', dailyLimit: 300, isLimit: true, color: 'var(--accent-rose)', glowColor: 'var(--accent-rose-glow)', fieldKey: 'cholesterol' },
  { id: 'micro_zinc', name: 'Zinc', emoji: '⚡', unit: 'mg', dailyLimit: 11, isLimit: false, color: 'var(--accent-purple)', glowColor: 'var(--accent-purple-glow)', fieldKey: 'zinc' },
  { id: 'micro_folate', name: 'Folate', emoji: '🥬', unit: 'mcg', dailyLimit: 400, isLimit: false, color: 'var(--accent-teal)', glowColor: 'var(--accent-teal-glow)', fieldKey: 'folate' },
  { id: 'micro_b12', name: 'Vitamin B12', emoji: '💊', unit: 'mcg', dailyLimit: 2.4, isLimit: false, color: 'var(--accent-blue)', glowColor: 'var(--accent-blue-glow)', fieldKey: 'vitaminB12' },
];

const GOAL_LIMIT_KEYS: Partial<Record<string, keyof UserGoals>> = {
  addedSugar: 'addedSugar',
  fiber: 'fiber',
  sodium: 'sodium',
};

/** Starter micronutrient set for new installs (respects legacy visibleMicros toggles). */
export function buildDefaultMicros(
  goals: UserGoals,
  vis?: { addedSugar?: boolean; fiber?: boolean; sodium?: boolean }
): CustomMicro[] {
  return DEFAULT_MICRO_CATALOG.map((def) => {
    const goalKey = GOAL_LIMIT_KEYS[def.fieldKey];
    const dailyLimit = goalKey && goals[goalKey] != null ? Number(goals[goalKey]) : def.dailyLimit;
    let hidden: boolean | undefined;
    if (def.fieldKey === 'addedSugar' && vis?.addedSugar === false) hidden = true;
    else if (def.fieldKey === 'fiber' && vis?.fiber === false) hidden = true;
    else if (def.fieldKey === 'sodium' && vis?.sodium === false) hidden = true;
    return { ...def, dailyLimit, hidden };
  });
}

/** Append catalog entries missing from an existing list (migration / upgrades). */
export function mergeDefaultMicroCatalog(existing: CustomMicro[]): CustomMicro[] {
  const seen = new Set(existing.map((m) => m.fieldKey.toLowerCase()));
  const merged = [...existing];
  for (const def of DEFAULT_MICRO_CATALOG) {
    if (seen.has(def.fieldKey.toLowerCase())) continue;
    merged.push({ ...def, hidden: undefined });
    seen.add(def.fieldKey.toLowerCase());
  }
  return merged;
}
