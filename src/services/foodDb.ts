import type { FoodItem, CoachResponse } from '../types/nutrition';

// Open Food Facts — free, public, no key required.
const OFF_BASE = 'https://world.openfoodfacts.org';

export interface FoodDbResult {
  item: Omit<FoodItem, 'id'>;
  brand?: string;
  barcode?: string;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function productToItem(p: any): Omit<FoodItem, 'id'> | null {
  const n = p?.nutriments || {};
  const name =
    [String(p?.brands || '').split(',')[0]?.trim(), p?.product_name]
      .filter(Boolean)
      .join(' ')
      .trim() || p?.product_name || 'Scanned product';

  // Prefer per-serving values when the product declares a serving; else fall back to per-100g.
  const hasServing = n['energy-kcal_serving'] != null || n['proteins_serving'] != null;
  const suffix = hasServing ? '_serving' : '_100g';
  const get = (base: string) => n[`${base}${suffix}`];

  const calories = Math.round(num(n[`energy-kcal${suffix}`] ?? n['energy-kcal_100g']));
  const protein = Math.round(num(get('proteins')) * 10) / 10;
  const carbs = Math.round(num(get('carbohydrates')) * 10) / 10;
  const fat = Math.round(num(get('fat')) * 10) / 10;
  const sugar = Math.round(num(get('sugars')) * 10) / 10;
  const fiber = Math.round(num(get('fiber')) * 10) / 10;
  // OFF stores sodium in grams; HaloCal tracks mg.
  const sodium = Math.round(num(get('sodium')) * 1000);

  // If there is no usable energy value the record is too sparse to be useful.
  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) return null;

  const quantity = hasServing ? (p?.serving_size || '1 serving') : '100 g';

  return {
    name,
    quantity,
    calories,
    protein,
    carbs,
    fat,
    sugar: sugar || undefined,
    fiber: fiber || undefined,
    sodium: sodium || undefined,
    confidence: 'high',
  };
}

// Cache successful barcode lookups for a week — repeat scans of the same product
// (very common: pantry staples) then resolve instantly instead of re-hitting OFF.
const BARCODE_CACHE_PREFIX = 'halocal_barcode_cache_';
const BARCODE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function readBarcodeCache(barcode: string): FoodDbResult | null {
  try {
    const raw = localStorage.getItem(BARCODE_CACHE_PREFIX + barcode);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { ts: number; result: FoodDbResult };
    if (!entry?.ts || Date.now() - entry.ts > BARCODE_CACHE_TTL) {
      localStorage.removeItem(BARCODE_CACHE_PREFIX + barcode);
      return null;
    }
    return entry.result;
  } catch {
    return null;
  }
}

function writeBarcodeCache(barcode: string, result: FoodDbResult): void {
  try {
    localStorage.setItem(BARCODE_CACHE_PREFIX + barcode, JSON.stringify({ ts: Date.now(), result }));
  } catch {
    /* quota/unavailable — caching is best-effort */
  }
}

/**
 * Look up a product by barcode (UPC/EAN). Returns null ONLY for a genuine
 * not-found (the API answered, no such product). A network/transient failure
 * throws so the caller can distinguish "type it instead" from "check connection"
 * — falling back to a cached hit first if we have one.
 */
export async function lookupBarcode(barcode: string): Promise<FoodDbResult | null> {
  const cached = readBarcodeCache(barcode);
  if (cached) return cached;

  const fields = 'product_name,brands,nutriments,serving_size,serving_quantity';
  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('network');
  }
  if (!res.ok) throw new Error('network');

  const data = await res.json();
  if (data?.status !== 1 || !data.product) return null; // genuine not-found

  const item = productToItem(data.product);
  if (!item) return null;
  const result: FoodDbResult = { item, brand: data.product.brands, barcode };
  writeBarcodeCache(barcode, result);
  return result;
}

const SEARCH_CACHE_PREFIX = 'halocal_search_cache_';
const SEARCH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function readSearchCache(key: string): FoodDbResult[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { ts: number; results: FoodDbResult[] };
    if (!entry?.ts || Date.now() - entry.ts > SEARCH_CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.results;
  } catch {
    return null;
  }
}

function writeSearchCache(key: string, results: FoodDbResult[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), results }));
  } catch {
    /* best-effort */
  }
}

/**
 * Free-text product search against Open Food Facts. Caches successful queries for
 * a week and falls back to that cache when the network is unavailable, so repeat
 * searches keep working offline. Aborts propagate; a cold network failure rethrows.
 */
export async function searchFoods(query: string, limit = 12, signal?: AbortSignal): Promise<FoodDbResult[]> {
  const q = query.trim();
  if (!q) return [];
  const cacheKey = SEARCH_CACHE_PREFIX + q.toLowerCase();
  const fields = 'code,product_name,brands,nutriments,serving_size';
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=${fields}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return readSearchCache(cacheKey) ?? [];
    const data = await res.json();
    const products: any[] = Array.isArray(data?.products) ? data.products : [];
    const results: FoodDbResult[] = [];
    for (const p of products) {
      const item = productToItem(p);
      if (item) results.push({ item, brand: p.brands, barcode: p.code });
    }
    if (results.length) writeSearchCache(cacheKey, results);
    return results;
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e;
    const cached = readSearchCache(cacheKey);
    if (cached) return cached;
    throw e;
  }
}

/** Wrap a barcode result as a CoachResponse so it can flow through the existing staging modal. */
export function barcodeResultToCoachResponse(result: FoodDbResult): CoachResponse {
  return {
    type: 'food',
    items: [result.item],
    coachingMessage: `Scanned ${result.item.name} from the Open Food Facts database — verified nutrition for ${result.item.quantity}.`,
  };
}
