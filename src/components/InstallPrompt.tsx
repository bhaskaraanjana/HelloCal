import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { isNative } from '../services/native';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'hellocal_install_dismissed';

/**
 * Custom "Add to Home Screen" prompt. Captures the beforeinstallprompt event,
 * shows a tasteful bottom banner, and triggers the native install flow.
 * Hidden inside the Capacitor app (already installed) and after dismissal.
 */
export const InstallPrompt: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isNative()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setVisible(false);
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install HelloCal"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        zIndex: 2500,
        width: 'min(440px, calc(100% - 2rem))',
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        padding: '0.9rem 1rem',
        background: 'rgba(19, 21, 32, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border-glass-glow)',
        borderRadius: '16px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 30px var(--accent-purple-glow)',
        animation: 'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'var(--accent-purple)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          flexShrink: 0,
          boxShadow: '0 0 16px var(--accent-purple-glow)',
        }}
      >
        <Download size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          Install HelloCal
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Add to your home screen for instant, full-screen tracking.
        </div>
      </div>
      <button onClick={install} className="btn btn-primary" style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', borderRadius: '10px', flexShrink: 0 }}>
        Install
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="btn-icon"
        style={{ width: '32px', height: '32px', flexShrink: 0 }}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default InstallPrompt;
