import { getSupabase, isSupabaseConfigured } from './supabase';

// One row per user holds the full HelloCal data blob as JSONB. This mirrors the
// existing localStorage model (a single StorageData object), keeps RLS trivial
// (a user can only touch their own row), and makes backup/restore a clean
// last-write-wins push/pull. See supabase/schema.sql.
const TABLE = 'user_data';
const NOT_CONFIGURED = 'Cloud sync is not configured on this build.';

export interface CloudUser {
  id: string;
  email: string | null;
}

async function requireClient() {
  const c = await getSupabase();
  if (!c) throw new Error(NOT_CONFIGURED);
  return c;
}

export async function getCurrentUser(): Promise<CloudUser | null> {
  const c = await getSupabase();
  if (!c) return null;
  const { data } = await c.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export async function signIn(email: string, password: string): Promise<CloudUser> {
  const c = await requireClient();
  const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  return { id: data.user!.id, email: data.user!.email ?? null };
}

export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const c = await requireClient();
  const { data, error } = await c.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  // When email confirmation is enabled there is no session until the link is clicked.
  return { needsConfirmation: !data.session };
}

export async function signOut(): Promise<void> {
  const c = await getSupabase();
  if (c) await c.auth.signOut();
}

/** Subscribe to auth changes; returns an unsubscribe fn (no-op if unconfigured). */
export function onAuthChange(cb: (user: CloudUser | null) => void): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getSupabase().then((c) => {
    if (!c || cancelled) return;
    const { data } = c.auth.onAuthStateChange((_event, session) => {
      cb(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null);
    });
    unsubscribe = () => data.subscription.unsubscribe();
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

/** Push a backup JSON string to the signed-in user's cloud row. Returns the new updated_at. */
export async function pushData(jsonString: string): Promise<string> {
  const c = await requireClient();
  const { data: u } = await c.auth.getUser();
  if (!u.user) throw new Error('Sign in to sync.');
  let payload: unknown;
  try {
    payload = JSON.parse(jsonString);
  } catch {
    throw new Error('Local data is unreadable; cannot sync.');
  }
  const updatedAt = new Date().toISOString();
  const { error } = await c.from(TABLE).upsert({ user_id: u.user.id, data: payload, updated_at: updatedAt }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  return updatedAt;
}

/** Pull the signed-in user's cloud row as a JSON string (or null if none stored yet). */
export async function pullData(): Promise<{ json: string; updatedAt: string } | null> {
  const c = await requireClient();
  const { data: u } = await c.auth.getUser();
  if (!u.user) throw new Error('Sign in to sync.');
  const { data, error } = await c.from(TABLE).select('data, updated_at').eq('user_id', u.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { json: JSON.stringify(data.data), updatedAt: data.updated_at };
}

export { isSupabaseConfigured };
