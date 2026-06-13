import { describe, it, expect } from 'vitest';
import {
  isSupabaseConfigured,
  getCurrentUser,
  signIn,
  signUp,
  signOut,
  pushData,
  pullData,
  onAuthChange,
} from './cloudSync';

// In the test env VITE_SUPABASE_* are unset, so cloud sync is NOT configured.
// These verify the app degrades gracefully (no throws on read paths, clear
// errors on write paths) — i.e. the offline-first guarantee holds.
describe('cloudSync (unconfigured)', () => {
  it('reports not configured', () => {
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('getCurrentUser resolves null without throwing', async () => {
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('signOut is a safe no-op', async () => {
    await expect(signOut()).resolves.toBeUndefined();
  });

  it('onAuthChange returns a no-op unsubscribe that does not throw', () => {
    const unsub = onAuthChange(() => {});
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });

  it('mutating operations reject with a clear "not configured" error', async () => {
    await expect(signIn('a@b.com', 'pw')).rejects.toThrow(/not configured/i);
    await expect(signUp('a@b.com', 'pw')).rejects.toThrow(/not configured/i);
    await expect(pushData('{}')).rejects.toThrow(/not configured/i);
    await expect(pullData()).rejects.toThrow(/not configured/i);
  });
});
