import React, { useState } from 'react';
import {
  CloudDownload,
  CloudUpload,
  Loader2,
  LogOut,
  Mail,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { CloudAccount } from '../services/cloudSync';
import { accountInitials, formatSyncTime } from '../services/accountSync';

export type AccountAuthMode = 'signin' | 'signup' | 'reset';

export interface CloudSyncStatus {
  lastAt: string | null;
  syncing: boolean;
  error: string | null;
}

interface AccountSectionProps {
  configured: boolean;
  account: CloudAccount | null;
  syncStatus: CloudSyncStatus;
  onSignInGoogle: () => void | Promise<void>;
  onSignInEmail: (email: string, password: string) => void | Promise<void>;
  onSignUp: (email: string, password: string) => void | Promise<void>;
  onPasswordReset: (email: string) => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
  onPush: () => void | Promise<void>;
  onPull: () => void | Promise<void>;
}

const PROVIDER_LABEL: Record<CloudAccount['authProvider'], string> = {
  google: 'Google',
  email: 'Email',
  unknown: 'Account',
};

export const AccountSection: React.FC<AccountSectionProps> = ({
  configured,
  account,
  syncStatus,
  onSignInGoogle,
  onSignInEmail,
  onSignUp,
  onPasswordReset,
  onSignOut,
  onPush,
  onPull,
}) => {
  const [mode, setMode] = useState<AccountAuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const run = async (fn: () => void | Promise<void>) => {
    setMessage(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="account-section account-section--unconfigured">
        <p className="settings-section-lead">
          Cloud sign-in is off on this build. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> (see SUPABASE.md), or use Export / Restore below.
        </p>
      </div>
    );
  }

  if (account) {
    const syncLabel = syncStatus.syncing
      ? 'Syncing…'
      : syncStatus.error
        ? 'Sync issue'
        : syncStatus.lastAt
          ? `Synced ${formatSyncTime(syncStatus.lastAt)}`
          : 'Auto-sync on';

    return (
      <div className="account-section account-section--signed-in">
        <div className="account-card">
          <div className="account-card__avatar" aria-hidden="true">
            {accountInitials(account.email)}
          </div>
          <div className="account-card__body">
            <p className="account-card__email">{account.email ?? 'Signed in'}</p>
            <div className="account-card__meta">
              <span className="account-provider-pill">{PROVIDER_LABEL[account.authProvider]}</span>
              <span
                className={`account-sync-pill${syncStatus.error ? ' is-error' : ''}${syncStatus.syncing ? ' is-syncing' : ''}`}
              >
                {syncStatus.syncing ? <Loader2 size={12} className="account-spin" aria-hidden /> : null}
                {syncLabel}
              </span>
            </div>
          </div>
        </div>

        {syncStatus.error ? (
          <p className="account-inline-msg account-inline-msg--err" role="alert">
            <AlertCircle size={14} aria-hidden />
            {syncStatus.error}
          </p>
        ) : (
          <p className="account-inline-msg account-inline-msg--ok">
            <CheckCircle2 size={14} aria-hidden />
            Changes on this device auto-save to your account while signed in.
          </p>
        )}

        <div className="account-actions">
          <button
            type="button"
            disabled={busy || syncStatus.syncing}
            onClick={() => run(onPush)}
            className="btn btn-secondary account-action-btn"
          >
            <CloudUpload size={16} aria-hidden />
            Back up now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onPull)}
            className="btn btn-secondary account-action-btn"
          >
            <CloudDownload size={16} aria-hidden />
            Restore from cloud
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onSignOut)}
            className="btn btn-secondary account-action-btn account-action-btn--muted"
          >
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="account-section account-section--signed-out">
      <button
        type="button"
        disabled={busy}
        onClick={() => run(onSignInGoogle)}
        className="btn btn-primary settings-google-btn account-google-btn"
      >
        {busy ? <Loader2 size={18} className="account-spin" aria-hidden /> : null}
        Continue with Google
      </button>

      <div className="account-divider" role="separator">
        <span>or use email</span>
      </div>

      <div className="account-mode-tabs" role="tablist" aria-label="Account mode">
        {(['signin', 'signup'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            className={`account-mode-tab${mode === tab ? ' is-active' : ''}`}
            onClick={() => { setMode(tab); setMessage(null); }}
          >
            {tab === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      {mode === 'reset' ? (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await onPasswordReset(email);
              setMessage({ type: 'ok', text: 'Check your email for a reset link.' });
              setMode('signin');
            });
          }}
        >
          <p className="settings-section-lead">Enter your email and we&apos;ll send a reset link.</p>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            aria-label="Email"
            className="input-field"
          />
          <div className="account-form__row">
            <button type="submit" disabled={busy} className="btn btn-primary account-form__submit">
              Send reset link
            </button>
            <button
              type="button"
              className="account-link-btn"
              onClick={() => { setMode('signin'); setMessage(null); }}
            >
              Back to sign in
            </button>
          </div>
        </form>
      ) : (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => (mode === 'signin' ? onSignInEmail(email, password) : onSignUp(email, password)));
          }}
        >
          <label className="account-field">
            <span className="account-field__label">
              <Mail size={14} aria-hidden />
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="input-field"
            />
          </label>
          <label className="account-field">
            <span className="account-field__label">Password</span>
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              className="input-field"
            />
          </label>

          {mode === 'signin' ? (
            <button
              type="button"
              className="account-link-btn account-forgot"
              onClick={() => { setMode('reset'); setMessage(null); setPassword(''); }}
            >
              Forgot password?
            </button>
          ) : (
            <p className="account-form__hint">
              We&apos;ll email a confirmation link if your project requires it.
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary account-form__submit">
            {busy ? <Loader2 size={16} className="account-spin" aria-hidden /> : null}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      )}

      {message ? (
        <p
          className={`account-inline-msg account-inline-msg--${message.type === 'ok' ? 'ok' : 'err'}`}
          role={message.type === 'err' ? 'alert' : 'status'}
        >
          {message.type === 'err' ? <AlertCircle size={14} aria-hidden /> : <CheckCircle2 size={14} aria-hidden />}
          {message.text}
        </p>
      ) : null}
    </div>
  );
};

export default AccountSection;
