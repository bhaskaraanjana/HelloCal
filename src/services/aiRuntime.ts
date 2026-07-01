import { isSupabaseConfigured } from './supabase';

/** How AI requests are routed: HelloCal-hosted Gemini vs the user's own API key. */
export type AiProvider = 'hosted' | 'custom';

export type AiCredentials =
  | { mode: 'hosted' }
  | { mode: 'custom'; apiKey: string };

export interface AiAccess {
  provider: AiProvider;
  customApiKey: string;
  cloudSignedIn: boolean;
}

export function isHostedAiAvailable(): boolean {
  return isSupabaseConfigured();
}

export function isAiReady(access: AiAccess): boolean {
  if (access.provider === 'hosted') {
    return access.cloudSignedIn && isHostedAiAvailable();
  }
  return Boolean(access.customApiKey?.trim());
}

export function toAiCredentials(access: AiAccess): AiCredentials {
  if (access.provider === 'hosted') {
    return { mode: 'hosted' };
  }
  return { mode: 'custom', apiKey: access.customApiKey.trim() };
}

export function assertAiReady(access: AiAccess, feature = 'AI features'): void {
  if (isAiReady(access)) return;
  if (access.provider === 'hosted') {
    throw new Error(`Sign in with Google or email to use ${feature}.`);
  }
  throw new Error('Gemini API key is required. Add your key in Settings or switch to HelloCal AI.');
}
