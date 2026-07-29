import { getSupabase, isSupabaseConfigured } from './supabase';
import { hasMeaningfulBackup } from './accountSync';

export { hasMeaningfulBackup, formatSyncTime, accountInitials } from './accountSync';

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

export type CloudAuthProvider = 'google' | 'email' | 'unknown';

export interface CloudAccount extends CloudUser {
  authProvider: CloudAuthProvider;
}

export interface SyncConflictInfo {
  localHasData: boolean;
  remoteHasData: boolean;
  remoteUpdatedAt: string | null;
}

async function requireClient() {
  const c = await getSupabase();
  if (!c) throw new Error(NOT_CONFIGURED);
  return c;
}

export async function getCurrentUser(): Promise<CloudUser | null> {
  const account = await getAccountDetails();
  return account;
}

function resolveAuthProvider(user: { app_metadata?: Record<string, unknown>; identities?: { provider?: string }[] }): CloudAuthProvider {
  const meta = user.app_metadata?.provider;
  if (meta === 'google') return 'google';
  if (meta === 'email') return 'email';
  const idProvider = user.identities?.[0]?.provider;
  if (idProvider === 'google') return 'google';
  if (idProvider === 'email') return 'email';
  return 'unknown';
}

/** Signed-in account with auth provider (for Settings UI). */
export async function getAccountDetails(): Promise<CloudAccount | null> {
  const c = await getSupabase();
  if (!c) return null;
  const { data } = await c.auth.getUser();
  if (!data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    authProvider: resolveAuthProvider(data.user),
  };
}

export async function signIn(email: string, password: string): Promise<CloudAccount> {
  const c = await requireClient();
  const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  const user = data.user!;
  return {
    id: user.id,
    email: user.email ?? null,
    authProvider: resolveAuthProvider(user),
  };
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
export function onAuthChange(cb: (user: CloudAccount | null, event: string) => void): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getSupabase().then((c) => {
    if (!c || cancelled) return;
    const { data } = c.auth.onAuthStateChange((event, session) => {
      const user = session?.user
        ? {
            id: session.user.id,
            email: session.user.email ?? null,
            authProvider: resolveAuthProvider(session.user),
          }
        : null;
      cb(user, event);
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

/** Start Google OAuth (redirects away and returns on callback). */
export async function signInWithGoogle(): Promise<void> {
  const c = await requireClient();
  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname || '/'}`
    : undefined;
  const { error } = await c.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw new Error(error.message);
}

/** Send a password-reset email (Supabase Auth). */
export async function requestPasswordReset(email: string): Promise<void> {
  const c = await requireClient();
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw new Error(error.message);
}

/** Remote backup timestamp without downloading the full payload. */
export async function fetchRemoteMeta(): Promise<{ updatedAt: string } | null> {
  const c = await requireClient();
  const { data: u } = await c.auth.getUser();
  if (!u.user) throw new Error('Sign in to sync.');
  const { data, error } = await c.from(TABLE).select('updated_at').eq('user_id', u.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { updatedAt: data.updated_at as string };
}

/** Compare local vs cloud to see if the user must pick a winner. */
export async function detectSyncConflict(localJson: string): Promise<SyncConflictInfo> {
  const localHasData = hasMeaningfulBackup(localJson);
  if (!localHasData) {
    return { localHasData: false, remoteHasData: false, remoteUpdatedAt: null };
  }
  const remote = await pullData();
  return {
    localHasData,
    remoteHasData: remote ? hasMeaningfulBackup(remote.json) : false,
    remoteUpdatedAt: remote?.updatedAt ?? null,
  };
}

/**
 * On sign-in: pull cloud data when only remote has content, push when only local does,
 * or signal a conflict when both sides have meaningful data.
 */
export async function syncOnLogin(localJson: string): Promise<'pulled' | 'pushed' | 'conflict' | 'noop'> {
  const localHas = hasMeaningfulBackup(localJson);
  const remote = await pullData();
  const remoteHas = remote ? hasMeaningfulBackup(remote.json) : false;

  if (localHas && remoteHas) return 'conflict';
  if (remoteHas) return 'pulled';
  if (localHas) {
    await pushData(localJson);
    return 'pushed';
  }
  if (!remoteHas) {
    await pushData(localJson);
    return 'pushed';
  }
  return 'noop';
}

export { isSupabaseConfigured };
