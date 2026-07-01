import type { FoodItem, FavoriteFood } from '../types/nutrition';
import { DEFAULT_MICRO_CATALOG } from './defaultMicros';
import { NUTRIENT_FIELDS } from './logMath';

export const MICRO_FIELD_ALIASES: Record<string, string> = {
  addedsugar: 'addedSugar',
  dietaryfiber: 'fiber',
  fiber: 'fiber',
  totalsugar: 'sugar',
  sugar: 'sugar',
  sodium: 'sodium',
  iron: 'iron',
  protein: 'protein',
  carbs: 'carbs',
  carbohydrates: 'carbs',
  fat: 'fat',
  calories: 'calories',
  calcium: 'calcium',
  potassium: 'potassium',
  cholesterol: 'cholesterol',
  saturatedfat: 'saturatedFat',
  transfat: 'transFat',
  vitamina: 'vitaminA',
  vitaminc: 'vitaminC',
  vitamind: 'vitaminD',
  vitaminb12: 'vitaminB12',
  zinc: 'zinc',
  magnesium: 'magnesium',
  folate: 'folate',
  vitd: 'vitaminD',
  vitd3: 'vitaminD',
  vitamind3: 'vitaminD',
  vita: 'vitaminA',
  vitc: 'vitaminC',
  vitb12: 'vitaminB12',
  satfat: 'saturatedFat',
  folicacid: 'folate',
  omega3: 'omega3',
  omega6: 'omega6',
  'omega-3': 'omega3',
  'omega-6': 'omega6',
  omegas3: 'omega3',
  omegas6: 'omega6',
};

/** Top-level FoodItem keys the AI parser populates (excluding macros). */
export const TOP_LEVEL_MICRO_FIELDS = NUTRIENT_FIELDS.filter(
  (k) => !['calories', 'protein', 'carbs', 'fat', 'saturatedFat', 'transFat'].includes(k)
);

/** Keys that live in FoodItem.micros (lowercase) but may be tracked on the dashboard. */
export const MICROS_MAP_FIELDS = new Set([
  'omega3',
  'omega6',
  'selenium',
  'copper',
  'vitamink',
  'vitamine',
  'vitaminb6',
  'vitaminb1',
  'vitaminb2',
  'vitaminb3',
  'iodine',
  'choline',
  'manganese',
  'niacin',
  'riboflavin',
  'thiamin',
  'chromium',
  'biotin',
  'pantothenicacid',
  'phosphorus',
  'molybdenum',
  'fluoride',
]);

const TOP_LEVEL_MICRO_SET = new Set<string>(TOP_LEVEL_MICRO_FIELDS);
const CATALOG_FIELD_KEYS = new Set(DEFAULT_MICRO_CATALOG.map((m) => m.fieldKey));

/** Top-level FoodItem keys promoted from root/micros on ingest (incl. fat subtypes). */
export const PROMOTABLE_TOP_LEVEL_FIELDS = new Set<string>([
  ...TOP_LEVEL_MICRO_FIELDS,
  'saturatedFat',
  'transFat',
]);

const INTEGER_FIELDS = new Set([
  'calories', 'sodium', 'potassium', 'calcium', 'cholesterol', 'magnesium',
]);

const finite = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const nonNeg = (v: unknown, fallback = 0): number => {
  const n = finite(v);
  return n >= 0 ? n : fallback;
};

/** Round a nutrient value the same way coerceFoodItem does on ingest. */
export function roundNutrientValue(field: string, value: number): number {
  const n = nonNeg(value);
  if (field === 'calories' || INTEGER_FIELDS.has(field)) return Math.round(n);
  return Math.round(n * 10) / 10;
}

function isNumericLike(val: unknown): val is number | string {
  if (typeof val === 'number') return Number.isFinite(val);
  return typeof val === 'string' && val !== '' && !Number.isNaN(Number(val));
}

/**
 * Pull unknown numeric keys (root or micros) into either promotable top-level
 * fields or the micros map, resolving aliases (addedsugar -> addedSugar, etc.).
 */
export function absorbExtraNutrients(
  raw: Record<string, unknown>,
  knownKeys: string[],
  existingTop: Partial<FoodItem> = {}
): { promoted: Partial<FoodItem>; micros: Record<string, number> } {
  const promoted: Partial<FoodItem> = {};
  const micros: Record<string, number> = {};

  const absorb = (key: string, val: unknown) => {
    if (!isNumericLike(val)) return;
    const canonical = canonicalMicroFieldKey(key);
    const rounded = roundNutrientValue(canonical, nonNeg(val));
    if (PROMOTABLE_TOP_LEVEL_FIELDS.has(canonical)) {
      const top = existingTop as Record<string, unknown>;
      const prior = top[canonical] ?? (promoted as Record<string, unknown>)[canonical];
      if (prior === undefined) (promoted as Record<string, number>)[canonical] = rounded;
      return;
    }
    const mk = canonical.toLowerCase();
    if (micros[mk] === undefined) micros[mk] = Math.round(rounded * 100) / 100;
  };

  for (const key of Object.keys(raw)) {
    if (knownKeys.includes(key) || key === 'micros') continue;
    absorb(key, raw[key]);
  }
  if (raw.micros && typeof raw.micros === 'object') {
    for (const [key, val] of Object.entries(raw.micros as Record<string, unknown>)) {
      absorb(key, val);
    }
  }

  return { promoted, micros };
}

/** Drop micros-map entries that duplicate a populated top-level field. */
export function finalizeFoodNutrients<T extends Partial<FoodItem>>(item: T): T {
  const out = { ...item } as Partial<FoodItem>;
  const micros = { ...(out.micros ?? {}) };

  for (const field of PROMOTABLE_TOP_LEVEL_FIELDS) {
    const top = (out as Record<string, unknown>)[field];
    if (top === undefined || top === null) {
      const mk = field.toLowerCase();
      const fromMicros = micros[mk];
      if (fromMicros !== undefined) {
        (out as Record<string, number>)[field] = roundNutrientValue(field, fromMicros);
        delete micros[mk];
      }
      continue;
    }
    delete micros[field.toLowerCase()];
  }

  out.micros = Object.keys(micros).length > 0 ? micros : undefined;
  return out as T;
}

/** Normalize a tracked field key to the canonical FoodItem / micros key. */
export function canonicalMicroFieldKey(fieldKey: string): string {
  const trimmed = fieldKey.trim();
  if (!trimmed) return trimmed;
  const norm = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  return MICRO_FIELD_ALIASES[norm] ?? MICRO_FIELD_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/** Whether a custom micro can be summed from logged food items. */
export function isDataBackedMicroField(fieldKey: string): boolean {
  const canonical = canonicalMicroFieldKey(fieldKey);
  if (TOP_LEVEL_MICRO_SET.has(canonical)) return true;
  if (CATALOG_FIELD_KEYS.has(canonical)) return true;
  if (MICROS_MAP_FIELDS.has(canonical.toLowerCase())) return true;
  return false;
}

/** Read a single nutrient from a food item (top-level field or micros map). */
export function readFoodItemNutrient(
  item: Partial<FoodItem> & { micros?: Record<string, number> },
  fieldKey: string
): number {
  const canonical = canonicalMicroFieldKey(fieldKey);
  const raw = item as Record<string, unknown>;
  if (raw[canonical] !== undefined && raw[canonical] !== null) {
    return finite(raw[canonical]);
  }
  // Legacy hand-edited items may use wrong casing on top-level keys.
  const target = canonical.toLowerCase();
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k === 'string' && k.toLowerCase() === target && v !== undefined && v !== null) {
      return finite(v);
    }
  }
  if (item.micros && typeof item.micros === 'object') {
    for (const [k, v] of Object.entries(item.micros)) {
      if (k.toLowerCase() === target) return finite(v);
    }
  }
  return 0;
}

/** Copy all numeric nutrients (+ micros) from a food-shaped record. */
export function copyNutrientFields(
  source: Partial<FoodItem> & { micros?: Record<string, number> }
): Partial<FoodItem> {
  const out: Partial<FoodItem> = {};
  for (const k of NUTRIENT_FIELDS) {
    const v = (source as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      (out as Record<string, number>)[k] = v;
    }
  }
  if (source.micros && typeof source.micros === 'object') {
    const micros: Record<string, number> = {};
    for (const [k, v] of Object.entries(source.micros)) {
      if (typeof v === 'number' && Number.isFinite(v)) micros[k.toLowerCase()] = v;
    }
    if (Object.keys(micros).length > 0) out.micros = micros;
  }
  return out;
}

/** Copy auxiliary nutrients (everything except core macros) for favorites / presets. */
export function copyAuxiliaryNutrients(
  source: Partial<FoodItem> & { micros?: Record<string, number> }
): Partial<FoodItem> {
  const full = copyNutrientFields(source);
  delete full.calories;
  delete full.protein;
  delete full.carbs;
  delete full.fat;
  return full;
}

/** Rehydrate a favorite/recents chip into a loggable food item. */
export function foodItemFromFavorite(
  fav: Pick<FavoriteFood, 'name' | 'quantity' | 'calories' | 'protein' | 'carbs' | 'fat'> & Partial<FoodItem>
): Omit<FoodItem, 'id'> {
  return finalizeFoodNutrients({
    name: fav.name,
    quantity: fav.quantity,
    calories: fav.calories,
    protein: fav.protein,
    carbs: fav.carbs,
    fat: fav.fat,
    confidence: 'high',
    ...copyAuxiliaryNutrients(fav),
  }) as Omit<FoodItem, 'id'>;
}

export const DATA_BACKED_MICRO_FIELDS = {
  has(fieldKey: string): boolean {
    return isDataBackedMicroField(fieldKey);
  },
};
