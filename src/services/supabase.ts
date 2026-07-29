import type { SupabaseClient } from '@supabase/supabase-js';

// Cloud sync is OPTIONAL. The app is fully functional offline with localStorage;
// Supabase only adds cross-device backup/sync when these env vars are provided
// at build time (see SUPABASE.md / .env.example).
function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let value = raw.trim().replace(/\\/g, '/');
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, '')}`;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
    return parsed.origin;
  } catch {
    return undefined;
  }
}

const SUPABASE_URL = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** True when both Supabase env vars are present — gates all cloud-sync UI/logic. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseUrl(): string {
  return SUPABASE_URL as string;
}

export function getSupabaseAnonKey(): string {
  return SUPABASE_ANON_KEY as string;
}

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Lazily create the singleton Supabase client, or null if not configured. The
 * SDK is dynamically imported so it lands in its own chunk and never bloats the
 * initial bundle (it's only fetched when cloud sync is configured AND used).
 */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    );
  }
  return clientPromise;
}
