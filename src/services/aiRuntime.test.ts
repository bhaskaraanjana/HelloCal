import { describe, it, expect } from 'vitest';
import { isAiReady, toAiCredentials } from './aiRuntime';

describe('aiRuntime', () => {
  it('hosted mode requires cloud sign-in', () => {
    expect(isAiReady({ provider: 'hosted', customApiKey: '', cloudSignedIn: false })).toBe(false);
    expect(isAiReady({ provider: 'hosted', customApiKey: '', cloudSignedIn: true })).toBe(false);
  });

  it('custom mode requires a key', () => {
    expect(isAiReady({ provider: 'custom', customApiKey: '', cloudSignedIn: false })).toBe(false);
    expect(isAiReady({ provider: 'custom', customApiKey: 'abc', cloudSignedIn: false })).toBe(true);
  });

  it('maps access to credentials', () => {
    expect(toAiCredentials({ provider: 'hosted', customApiKey: 'x', cloudSignedIn: true })).toEqual({ mode: 'hosted' });
    expect(toAiCredentials({ provider: 'custom', customApiKey: ' key ', cloudSignedIn: false })).toEqual({ mode: 'custom', apiKey: 'key' });
  });
});
