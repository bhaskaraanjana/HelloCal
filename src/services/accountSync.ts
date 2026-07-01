/** Pure helpers for cloud backup / conflict analysis (no Supabase dependency). */

export function hasMeaningfulBackup(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return false;
    return (
      (Array.isArray(parsed.logs) && parsed.logs.length > 0)
      || (Array.isArray(parsed.workouts) && parsed.workouts.length > 0)
      || (Array.isArray(parsed.waterLogs) && parsed.waterLogs.length > 0)
      || (Array.isArray(parsed.recipes) && parsed.recipes.length > 0)
      || parsed.goals != null
    );
  } catch {
    return false;
  }
}

export function formatSyncTime(iso: string | null | undefined): string {
  if (!iso) return 'Not synced yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Not synced yet';
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 15) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function accountInitials(email: string | null | undefined): string {
  const e = (email ?? '').trim();
  if (!e) return '?';
  const local = e.split('@')[0] ?? e;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
