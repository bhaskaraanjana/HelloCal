import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchFoods, lookupBarcode } from './foodDb';

// Minimal in-memory localStorage for the cache layer.
function makeLocalStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
  } as Storage;
}

const product = {
  code: '123',
  product_name: 'Test Bar',
  brands: 'Brand',
  nutriments: { 'energy-kcal_100g': 200, 'proteins_100g': 10, 'carbohydrates_100g': 20, 'fat_100g': 5 },
};

const okJson = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response;

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('searchFoods', () => {
  it('returns [] for an empty query without hitting the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await searchFoods('   ')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps products and caches the result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ products: [product] })));
    const res = await searchFoods('bar');
    expect(res).toHaveLength(1);
    expect(res[0].item.calories).toBe(200);
    expect(localStorage.getItem('hellocal_search_cache_bar')).toBeTruthy();
  });

  it('serves the cache when a later fetch fails (offline)', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => okJson({ products: [product] }))
      .mockImplementationOnce(async () => { throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', fetchMock);
    await searchFoods('bar'); // primes the cache
    const offline = await searchFoods('bar'); // network down -> cache
    expect(offline).toHaveLength(1);
    expect(offline[0].item.name).toContain('Test Bar');
  });

  it('propagates an AbortError instead of swallowing it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }));
    await expect(searchFoods('bar')).rejects.toThrow();
  });

  it('returns [] on a non-ok response with no cache', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response));
    expect(await searchFoods('bar')).toEqual([]);
  });
});

describe('lookupBarcode', () => {
  it('returns a cached hit without touching the network', async () => {
    const fetchMock = vi.fn(async () => okJson({ status: 1, product }));
    vi.stubGlobal('fetch', fetchMock);
    await lookupBarcode('123'); // primes cache
    fetchMock.mockClear();
    const cached = await lookupBarcode('123');
    expect(cached?.item.calories).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null on a genuine not-found (status !== 1)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ status: 0 })));
    expect(await lookupBarcode('000')).toBeNull();
  });

  it('throws on a network failure (distinct from not-found)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(lookupBarcode('999')).rejects.toThrow();
  });

  it('throws on a non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response));
    await expect(lookupBarcode('999')).rejects.toThrow();
  });
});
