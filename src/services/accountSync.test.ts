import { describe, it, expect, vi, afterEach } from 'vitest';
import { hasMeaningfulBackup, formatSyncTime, accountInitials } from './accountSync';

describe('accountSync helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hasMeaningfulBackup detects logs', () => {
    expect(hasMeaningfulBackup('{}')).toBe(false);
    expect(hasMeaningfulBackup(JSON.stringify({ logs: [] }))).toBe(false);
    expect(hasMeaningfulBackup(JSON.stringify({ logs: [{ id: '1' }] }))).toBe(true);
    expect(hasMeaningfulBackup(JSON.stringify({ goals: { calories: 2000 } }))).toBe(true);
    expect(hasMeaningfulBackup('not json')).toBe(false);
  });

  it('formatSyncTime returns human labels', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T12:00:00Z'));
    expect(formatSyncTime(null)).toBe('Not synced yet');
    expect(formatSyncTime(new Date('2026-06-30T11:59:50Z').toISOString())).toBe('Just now');
    expect(formatSyncTime(new Date('2026-06-30T11:30:00Z').toISOString())).toBe('30m ago');
  });

  it('accountInitials derives from email', () => {
    expect(accountInitials('jane.doe@example.com')).toBe('JD');
    expect(accountInitials('solo@example.com')).toBe('SO');
    expect(accountInitials(null)).toBe('?');
  });
});
