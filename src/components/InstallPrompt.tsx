import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { isNative } from '../services/native';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'hellocal_install_dismissed';

export const InstallPrompt: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'standard' | 'ios' | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (isNative()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    // Check if already running in standalone mode (installed)
    const isStandalone = () => {
      return (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    };

    if (isStandalone()) return;

    // Detect iOS (iPhone, iPad, iPod, or modern iPad desktop mode with touch)
    const isIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIphone = /iphone|ipad|ipod/.test(userAgent);
      const isMacTouch = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
      return isIphone || isMacTouch;
    };

    if (isIOS()) {
      setPlatform('ios');
      setVisible(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setPlatform('standard');
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
    if (platform === 'ios') {
      setShowInstructions(true);
      return;
    }
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

  if (showInstructions) {
    return (
      <div
        role="dialog"
        aria-label="How to install HelloCal"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
          transform: 'translateX(-50%)',
          zIndex: 2500,
          width: 'min(440px, calc(100% - 2rem))',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          padding: '1.2rem 1.2rem',
          background: 'rgba(19, 21, 32, 0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.12))',
          borderRadius: '20px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 40px var(--accent-purple-glow, rgba(16, 185, 129, 0.3))',
          animation: 'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          color: 'var(--text-primary, #fff)',
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideIn {
            0% { transform: translate(-50%, 30px); opacity: 0; }
            100% { transform: translate(-50%, 0); opacity: 1; }
          }
        `}} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.6rem' }}>
          <span style={{ fontFamily: "var(--font-display, 'Outfit', sans-serif)", fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary, #fff)' }}>Install on iPhone / iPad</span>
          <button
            onClick={dismiss}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: '1.4' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent-purple, #10b981)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: '0.75rem' }}>1</div>
            <div>
              Tap the <strong>Share</strong> button in Safari (looks like a square with an arrow pointing up <span style={{ display: 'inline-flex', padding: '2px 4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', verticalAlign: 'middle' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg></span>).
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent-purple, #10b981)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: '0.75rem' }}>2</div>
            <div>
              Scroll down the share sheet and select <strong>Add to Home Screen</strong> <span style={{ display: 'inline-flex', padding: '2px 4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', verticalAlign: 'middle', fontWeight: 600 }}>+</span>.
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowInstructions(false)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-primary, #fff)',
            padding: '0.55rem',
            fontSize: '0.85rem',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 600,
            marginTop: '0.4rem',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        >
          Back
        </button>
      </div>
    );
  }

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
        border: '1px solid var(--border-glass-glow, rgba(255,255,255,0.08))',
        borderRadius: '16px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 30px var(--accent-purple-glow, rgba(16, 185, 129, 0.25))',
        animation: 'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        color: 'var(--text-primary, #fff)',
      }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideIn {
          0% { transform: translate(-50%, 30px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
      `}} />
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'var(--accent-purple, #10b981)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          flexShrink: 0,
          boxShadow: '0 0 16px var(--accent-purple-glow, rgba(16, 185, 129, 0.4))',
        }}
      >
        <Download size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display, 'Outfit', sans-serif)", fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary, #fff)' }}>
          Install HelloCal
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
          {platform === 'ios' 
            ? "Tap Share, then 'Add to Home Screen' for standalone access." 
            : "Add to home screen for instant, full-screen tracking."}
        </div>
      </div>
      <button 
        onClick={install} 
        style={{ 
          background: 'var(--accent-purple, #10b981)', 
          border: 'none', 
          color: '#fff', 
          padding: '0.55rem 1rem', 
          fontSize: '0.85rem', 
          borderRadius: '10px', 
          flexShrink: 0,
          cursor: 'pointer',
          fontWeight: 600,
          fontFamily: 'inherit',
          boxShadow: '0 4px 12px var(--accent-purple-glow, rgba(16, 185, 129, 0.3))'
        }}
      >
        {platform === 'ios' ? 'Guide' : 'Install'}
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        style={{ 
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted, #64748b)',
          cursor: 'pointer',
          width: '32px', 
          height: '32px', 
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          transition: 'all 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default InstallPrompt;
