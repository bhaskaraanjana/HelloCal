import React, { useState } from 'react';
import type { CoachPersonality, MealReminders, SupplementReminders } from '../types/nutrition';
import type { AiProvider } from '../services/aiRuntime';
import { shareText, isNative } from '../services/native';
import { Eye, EyeOff, Sparkles, ShieldAlert, Key, HardDriveDownload, HardDriveUpload, Bell, Cloud, Pill } from 'lucide-react';
import { APP_VERSION, COMMIT_HASH } from '../version';
import { AccountSection, type CloudSyncStatus } from './AccountSection';
import type { CloudAccount } from '../services/cloudSync';
import { CustomModal } from './ui/CustomModal';

interface SettingsProps {
  apiKey: string;
  aiProvider: AiProvider;
  hostedAiAvailable: boolean;
  personality: CoachPersonality;
  onSaveKey: (key: string) => void;
  onSaveAiProvider: (provider: AiProvider) => void;
  onSavePersonality: (personality: CoachPersonality) => void;
  onClearData: () => void;
  onImportData: (jsonData: string) => boolean;
  exportDataJson: string;
  reminders?: MealReminders;
  onSaveReminders?: (r: MealReminders) => void;
  supplementReminders?: SupplementReminders;
  onSaveSupplementReminders?: (r: SupplementReminders) => void;
  cloudConfigured?: boolean;
  cloudAccount?: CloudAccount | null;
  cloudSyncStatus?: CloudSyncStatus;
  onCloudSignIn?: (email: string, password: string) => void | Promise<void>;
  onCloudSignUp?: (email: string, password: string) => void | Promise<void>;
  onCloudSignInGoogle?: () => void | Promise<void>;
  onCloudPasswordReset?: (email: string) => void | Promise<void>;
  onCloudSignOut?: () => void | Promise<void>;
  onCloudPush?: () => void | Promise<void>;
  onCloudPull?: () => void | Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({
  apiKey,
  aiProvider,
  hostedAiAvailable,
  personality,
  onSaveKey,
  onSaveAiProvider,
  onSavePersonality,
  onClearData,
  onImportData,
  exportDataJson,
  reminders,
  onSaveReminders,
  supplementReminders,
  onSaveSupplementReminders,
  cloudConfigured,
  cloudAccount,
  cloudSyncStatus,
  onCloudSignIn,
  onCloudSignUp,
  onCloudSignInGoogle,
  onCloudPasswordReset,
  onCloudSignOut,
  onCloudPush,
  onCloudPull
}) => {
  const rem: MealReminders = reminders || { enabled: false, breakfast: '08:00', lunch: '12:30', dinner: '18:30', snack: '16:00' };
  const [remEnabled, setRemEnabled] = useState(rem.enabled);
  const [remBreakfast, setRemBreakfast] = useState(rem.breakfast);
  const [remLunch, setRemLunch] = useState(rem.lunch);
  const [remDinner, setRemDinner] = useState(rem.dinner);
  const [remSnack, setRemSnack] = useState(rem.snack || '16:00');

  const handleSaveReminders = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveReminders?.({ enabled: remEnabled, breakfast: remBreakfast, lunch: remLunch, dinner: remDinner, snack: remSnack });
    triggerSaveStatus('reminders');
  };

  const suppRem: SupplementReminders = supplementReminders || { enabled: false, morning: '08:00', lunch: '12:30', bedtime: '21:30' };
  const [suppRemEnabled, setSuppRemEnabled] = useState(suppRem.enabled);
  const [suppRemMorning, setSuppRemMorning] = useState(suppRem.morning);
  const [suppRemLunch, setSuppRemLunch] = useState(suppRem.lunch);
  const [suppRemBedtime, setSuppRemBedtime] = useState(suppRem.bedtime);

  const handleSaveSupplementReminders = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSupplementReminders?.({ enabled: suppRemEnabled, morning: suppRemMorning, lunch: suppRemLunch, bedtime: suppRemBedtime });
    triggerSaveStatus('supplementReminders');
  };
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  const [customDialog, setCustomDialog] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
    onDismiss?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
  });

  const showCustomAlert = (title: string, message: string, onConfirm?: () => void) => {
    setCustomDialog({
      isOpen: true,
      type: 'alert',
      title,
      message,
      onConfirm: () => {
        setCustomDialog(d => ({ ...d, isOpen: false }));
        if (onConfirm) onConfirm();
      }
    });
  };

  const showCustomConfirm = (title: string, message: string, onConfirm: () => void) => {
    setCustomDialog({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm: () => {
        setCustomDialog(d => ({ ...d, isOpen: false }));
        onConfirm();
      },
      onDismiss: () => {
        setCustomDialog(d => ({ ...d, isOpen: false }));
      }
    });
  };

  const [saveStatus, setSaveStatus] = useState<{ [key: string]: boolean }>({});

  const triggerSaveStatus = (key: string) => {
    setSaveStatus(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSaveStatus(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const handleSaveKey = () => {
    onSaveKey(keyInput);
    triggerSaveStatus('key');
  };

  const handleSelectPersonality = (p: CoachPersonality) => {
    onSavePersonality(p);
    triggerSaveStatus('personality');
  };

  const handleExport = () => {
    const filename = `hellocal_backup_${new Date().toISOString().split('T')[0]}.json`;
    // On native, use the share sheet (saves to Files/Drive/email); on web, downloads the file.
    if (isNative()) {
      shareText('HelloCal Backup', exportDataJson, filename);
      return;
    }
    const blob = new Blob([exportDataJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = onImportData(content);
      if (success) {
        showCustomAlert('Import Successful', 'Data successfully imported and active! Click OK to reload.', () => {
          window.location.reload();
        });
      } else {
        showCustomAlert('Import Failed', 'Failed to import data. Please verify the JSON file structure.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetWithConfirmation = () => {
    showCustomConfirm(
      'Caution: Wipe Local Data',
      'Are you absolutely sure you want to wipe all logs, calorie goals, and API keys? This operation is irreversible!',
      () => {
        onClearData();
        showCustomAlert('Database Purged', 'All local database items have been purged. Click OK to reload.', () => {
          window.location.reload();
        });
      }
    );
  };

  const handleSelectAiProvider = (provider: AiProvider) => {
    onSaveAiProvider(provider);
    triggerSaveStatus('aiProvider');
  };

  const remindersAnyOn = remEnabled || suppRemEnabled;

  return (
    <div className="settings-page">

      {/* Reminders — featured at top for discoverability */}
      <div className="glass-card settings-section settings-reminders-section motion-stagger" style={{ '--i': 0 } as React.CSSProperties}>
        <div className={`settings-reminders-spotlight${remindersAnyOn ? ' is-active' : ''}`}>
          <div className="settings-reminders-spotlight__icon" aria-hidden="true">
            <Bell size={22} />
          </div>
          <div className="settings-reminders-spotlight__copy">
            <p className="settings-reminders-spotlight__eyebrow">Built-in feature</p>
            <h2 className="settings-reminders-spotlight__title">Daily reminders</h2>
            <p className="settings-reminders-spotlight__lead">
              Schedule gentle nudges to log meals and take supplements — so tracking stays effortless even on busy days.
              {!isNative() && ' On the web, reminders work while HelloCal is open; install the app for background alerts.'}
            </p>
            <div className="settings-reminders-spotlight__status" aria-label="Reminder status">
              <span className={`settings-reminders-pill${remEnabled ? ' is-on' : ''}`}>
                <span aria-hidden>🍽</span> Meals {remEnabled ? 'on' : 'off'}
              </span>
              <span className={`settings-reminders-pill${suppRemEnabled ? ' is-on' : ''}`}>
                <Pill size={13} aria-hidden /> Supplements {suppRemEnabled ? 'on' : 'off'}
              </span>
            </div>
            {!remindersAnyOn ? (
              <p className="settings-reminders-spotlight__cta">Enable either option below to get started.</p>
            ) : null}
          </div>
        </div>

        <h3 className="settings-section-title">
          <Bell size={18} color="var(--accent-purple)" />
          Configure reminders
        </h3>

        {/* Meal Reminders Form */}
        <div className="settings-reminders-block">
          <form onSubmit={handleSaveReminders} className="settings-reminders-form">
            <label className="settings-reminders-toggle">
              <input
                type="checkbox"
                checked={remEnabled}
                onChange={(e) => setRemEnabled(e.target.checked)}
              />
              Enable meal reminders
            </label>

            <div className={`settings-reminders-times${remEnabled ? '' : ' is-disabled'}`}>
              {([
                ['Breakfast', remBreakfast, setRemBreakfast],
                ['Lunch', remLunch, setRemLunch],
                ['Snack', remSnack, setRemSnack],
                ['Dinner', remDinner, setRemDinner],
              ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
                <div key={label} className="settings-reminders-time-field">
                  <label>{label}</label>
                  <input
                    type="time"
                    value={value}
                    disabled={!remEnabled}
                    onChange={(e) => setter(e.target.value)}
                    aria-label={`${label} reminder time`}
                  />
                </div>
              ))}
            </div>

            <button type="submit" className="btn btn-primary settings-reminders-save">
              {saveStatus['reminders'] ? 'Meal Reminders Saved!' : 'Save Meal Reminders'}
            </button>
          </form>
        </div>

        {/* Supplement Reminders Form */}
        <div className="settings-reminders-block">
          <form onSubmit={handleSaveSupplementReminders} className="settings-reminders-form">
            <label className="settings-reminders-toggle">
              <input
                type="checkbox"
                checked={suppRemEnabled}
                onChange={(e) => setSuppRemEnabled(e.target.checked)}
              />
              <Pill size={16} color={suppRemEnabled ? 'var(--accent-purple)' : 'var(--text-muted)'} aria-hidden />
              Enable supplement reminders
            </label>

            <div className={`settings-reminders-times${suppRemEnabled ? '' : ' is-disabled'}`}>
              {([
                ['Morning', suppRemMorning, setSuppRemMorning],
                ['Lunch', suppRemLunch, setSuppRemLunch],
                ['Bedtime', suppRemBedtime, setSuppRemBedtime],
              ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
                <div key={label} className="settings-reminders-time-field">
                  <label>{label}</label>
                  <input
                    type="time"
                    value={value}
                    disabled={!suppRemEnabled}
                    onChange={(e) => setter(e.target.value)}
                    aria-label={`${label} supplement reminder time`}
                  />
                </div>
              ))}
            </div>

            <button type="submit" className="btn btn-primary settings-reminders-save">
              {saveStatus['supplementReminders'] ? 'Supplement Reminders Saved!' : 'Save Supplement Reminders'}
            </button>
          </form>
        </div>
      </div>

      {/* Account & cloud backup */}
      <div className="glass-card settings-section motion-stagger" style={{ '--i': 1 } as React.CSSProperties}>
        <h3 className="settings-section-title">
          <Cloud size={18} color="var(--accent-blue)" />
          Account &amp; cloud sync
        </h3>
        <p className="settings-section-lead">
          Sign in to back up your logs, goals, and settings across devices. HelloCal AI (voice, photo, and smart parsing) also runs through your account when you choose HelloCal AI below.
        </p>

        <AccountSection
          configured={!!cloudConfigured}
          account={cloudAccount ?? null}
          syncStatus={cloudSyncStatus ?? { lastAt: null, syncing: false, error: null }}
          onSignInGoogle={() => onCloudSignInGoogle?.()}
          onSignInEmail={(email, password) => onCloudSignIn?.(email, password)}
          onSignUp={(email, password) => onCloudSignUp?.(email, password)}
          onPasswordReset={(email) => onCloudPasswordReset?.(email)}
          onSignOut={() => onCloudSignOut?.()}
          onPush={() => onCloudPush?.()}
          onPull={() => onCloudPull?.()}
        />
      </div>

      {/* AI provider */}
      <div className="glass-card settings-section motion-stagger" style={{ '--i': 2 } as React.CSSProperties}>
        <h3 className="settings-section-title">
          <Sparkles size={18} color="var(--accent-purple)" />
          AI provider
        </h3>
        <p className="settings-section-lead">
          Choose how voice, photo, and smart parsing run. HelloCal AI uses our secure backend — no API key needed when signed in.
        </p>

        <div className="settings-ai-provider-grid">
          <button
            type="button"
            className={`settings-personality-card${aiProvider === 'hosted' ? ' is-active' : ''}`}
            disabled={!hostedAiAvailable}
            onClick={() => handleSelectAiProvider('hosted')}
          >
            <span className="settings-personality-card__label">HelloCal AI</span>
            <span className="settings-personality-card__desc">
              {hostedAiAvailable
                ? 'Powered by our backend. Sign in above — no personal Gemini key required.'
                : 'Requires cloud configuration on this build.'}
            </span>
            {saveStatus['aiProvider'] && aiProvider === 'hosted' ? (
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-teal)', fontWeight: 600 }}>Selected</span>
            ) : null}
          </button>
          <button
            type="button"
            className={`settings-personality-card${aiProvider === 'custom' ? ' is-active' : ''}`}
            onClick={() => handleSelectAiProvider('custom')}
          >
            <span className="settings-personality-card__label">Your Gemini key</span>
            <span className="settings-personality-card__desc">
              Bring your own free key from Google AI Studio. Works offline-first; cloud sign-in optional.
            </span>
            {saveStatus['aiProvider'] && aiProvider === 'custom' ? (
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-teal)', fontWeight: 600 }}>Selected</span>
            ) : null}
          </button>
        </div>

        {aiProvider === 'custom' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Paste your Gemini API key (AIzaSy...)"
                  className="input-field"
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem', paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button type="button" onClick={handleSaveKey} className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }}>
                {saveStatus['key'] ? 'Saved!' : 'Save key'}
              </button>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Get a free key at{' '}
              <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-purple)', fontWeight: 650 }}>
                Google AI Studio ↗
              </a>
            </span>
          </div>
        ) : cloudAccount ? (
          <p className="settings-section-lead" style={{ margin: 0, color: 'var(--accent-teal)' }}>
            <Key size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '0.25rem' }} />
            HelloCal AI is active for {cloudAccount.email ?? 'your account'}.
          </p>
        ) : (
          <p className="settings-section-lead" style={{ margin: 0 }}>
            Sign in with Google or email above to enable HelloCal AI.
          </p>
        )}
      </div>

      {/* Personalities Selector */}
      <div className="glass-card motion-stagger" style={{ '--i': 3, display: 'flex', flexDirection: 'column', gap: '1.25rem' } as React.CSSProperties}>
        <h3 style={{
          fontSize: '1.15rem',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          paddingBottom: '0.5rem'
        }}>
          <Sparkles size={18} color="var(--accent-teal)" style={{ animation: 'float 2s infinite' }} />
          Select AI Coach Tone
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem'
        }}>
          {([
            { id: 'encouraging', label: 'Warm Coach', desc: 'Positive, motivating, congratulatory, very gentle on diet slips.' },
            { id: 'strict', label: 'Strict Trainer', desc: 'Direct, no-nonsense. Demands high protein, alerts on junk sugars.' },
            { id: 'analytical', label: 'Scientist', desc: 'Analytical, objective facts. Focuses on fiber, glycemic loads, biology.' },
            { id: 'chill', label: 'Chill Buddy', desc: 'Super relaxed, laidback, casual high-fives and zero food guilt.' }
          ] as const).map(p => (
            <button
              key={p.id}
              type="button"
              className={`settings-personality-card${personality === p.id ? ' is-active' : ''}`}
              onClick={() => handleSelectPersonality(p.id)}
            >
              <span className="settings-personality-card__label">
                {p.label}
              </span>
              <span className="settings-personality-card__desc">
                {p.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Data Center */}
      <div className="glass-card motion-stagger" style={{ '--i': 4, display: 'flex', flexDirection: 'column', gap: '1.25rem' } as React.CSSProperties}>
        <h3 style={{
          fontSize: '1.15rem',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          paddingBottom: '0.5rem'
        }}>
          <ShieldAlert size={18} color="var(--accent-rose)" />
          Backup & Device Integrity Center
        </h3>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Your data lives on this device first. Export a JSON backup anytime, or sign in above to sync automatically with your account.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Export button */}
          <button 
            onClick={handleExport} 
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
          >
            <HardDriveDownload size={16} /> Export Backup JSON
          </button>

          {/* Import input trigger */}
          <label 
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}
          >
            <HardDriveUpload size={16} /> Restore Backup JSON
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport} 
              style={{ display: 'none' }}
            />
          </label>

          {/* Purge button */}
          <button 
            onClick={handleResetWithConfirmation} 
            className="btn btn-danger"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginLeft: 'auto' }}
          >
            Wipe Local Data
          </button>
        </div>
      </div>

      {/* Version Display */}
      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.5rem' }}>
        HelloCal v{APP_VERSION} (Commit: {COMMIT_HASH})
      </div>

      {customDialog.isOpen && (
        <CustomModal
          isOpen={customDialog.isOpen}
          onClose={() => {
            if (customDialog.type === 'confirm' && customDialog.onDismiss) {
              customDialog.onDismiss();
            } else if (customDialog.type === 'alert' && customDialog.onConfirm) {
              customDialog.onConfirm();
            } else {
              setCustomDialog(d => ({ ...d, isOpen: false }));
            }
          }}
          title={customDialog.title}
          size="sm"
          footer={
            customDialog.type === 'confirm' ? (
              <>
                <button
                  onClick={() => {
                    if (customDialog.onDismiss) customDialog.onDismiss();
                    else setCustomDialog(d => ({ ...d, isOpen: false }));
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={customDialog.onConfirm}
                  className="btn btn-danger"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                  Confirm
                </button>
              </>
            ) : (
              <button
                onClick={customDialog.onConfirm}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', width: '80px' }}
              >
                OK
              </button>
            )
          }
        >
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '0.5rem 0' }}>
            {customDialog.message}
          </div>
        </CustomModal>
      )}

    </div>
  );
};
export default Settings;
