import { getSupabase, getSupabaseAnonKey, getSupabaseUrl } from './supabase';

type GeminiPart = { text: string } | { inlineData: { data: string; mimeType: string } };

/**
 * Call the Supabase Edge Function that proxies Gemini with a server-held API key.
 * Requires an authenticated Supabase session (Google or email sign-in).
 */
export async function runHostedModel(parts: GeminiPart[], model = 'gemini-2.5-flash'): Promise<string> {
  const client = await getSupabase();
  if (!client) throw new Error('HelloCal AI is not available on this build.');

  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in to use HelloCal AI.');
  }

  const anonKey = getSupabaseAnonKey();
  const res = await fetch(`${getSupabaseUrl()}/functions/v1/gemini-proxy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parts, model }),
  });

  let payload: { text?: string; error?: string } = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }

  if (!res.ok) {
    throw new Error(payload.error || 'HelloCal AI request failed. Try again in a moment.');
  }
  if (!payload.text) {
    throw new Error('HelloCal AI returned an empty response.');
  }
  return payload.text;
}
