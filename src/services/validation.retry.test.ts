import { describe, it, expect, vi } from 'vitest';
import { withRetry, validateCommandResponse } from './validation';

describe('withRetry', () => {
  it('resolves on the first successful attempt', async () => {
    const fn = vi.fn(async () => 'ok');
    expect(await withRetry(fn, 3, 1)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient error then succeeds', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('503 service unavailable');
      return 'recovered';
    });
    expect(await withRetry(fn, 3, 1)).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a non-retryable error (bad API key) and maps the message', async () => {
    const fn = vi.fn(async () => { throw new Error('invalid api key provided'); });
    await expect(withRetry(fn, 3, 1)).rejects.toThrow(/key/i);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts attempts on a persistent transient error and maps to a quota message', async () => {
    const fn = vi.fn(async () => { throw new Error('429 rate limit / quota'); });
    await expect(withRetry(fn, 3, 1)).rejects.toThrow(/quota/i);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('validateCommandResponse', () => {
  it('throws on a non-object (null) response', () => {
    expect(() => validateCommandResponse(null)).toThrow();
  });

  it('returns safe defaults for an object missing fields', () => {
    const r = validateCommandResponse({});
    expect(r.updatedGoals).toEqual({});
    expect(r.updatedSettings).toEqual({});
    expect(r.aiResponse).toBe('Done!');
  });

  it('passes through provided goal/settings objects and the response text', () => {
    const r = validateCommandResponse({ updatedGoals: { protein: 150 }, updatedSettings: { theme: 'ocean' }, aiResponse: 'Done!' });
    expect(r.updatedGoals).toEqual({ protein: 150 });
    expect(r.updatedSettings).toEqual({ theme: 'ocean' });
    expect(r.aiResponse).toBe('Done!');
  });
});
