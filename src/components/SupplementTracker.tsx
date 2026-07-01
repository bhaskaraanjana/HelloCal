import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Supplement } from '../types/nutrition';
import { gemini } from '../services/gemini';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Pill, Plus, Check, Trash2, Sparkles, SlidersHorizontal, X, EyeOff } from 'lucide-react';
import { isAiReady, type AiAccess } from '../services/aiRuntime';

interface SupplementTrackerProps {
  supplements: Supplement[];
  aiAccess: AiAccess;
  onSave: (supplements: Supplement[]) => void;
  onToggleTaken: (id: string) => void;
  onError: (msg: string) => void;
  onHidePanel?: () => void;
  embedded?: boolean;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
}

const rid = () => `supp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const SCHEDULE_OPTIONS = ['Morning', 'Lunch', 'Bedtime', 'Evening', 'With meals'] as const;

const SETTINGS_CARD: React.CSSProperties = {
  border: '1px solid var(--border-glass)',
  borderRadius: '10px',
  padding: '0.6rem 0.7rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const iconBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: '1px solid var(--border-glass)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
};

/**
 * Daily supplement/stack tracker. The dashboard card is for quick check-off;
 * add, edit, dose, schedule, and remove live in the settings drawer.
 */
export const SupplementTracker: React.FC<SupplementTrackerProps> = ({
  supplements,
  aiAccess,
  onSave,
  onToggleTaken,
  onError,
  onHidePanel,
  embedded = false,
  settingsOpen: settingsOpenProp,
  onSettingsOpenChange,
}) => {
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const settingsOpen = settingsOpenProp ?? internalSettingsOpen;
  const setSettingsOpen = (open: boolean) => {
    if (settingsOpenProp === undefined) setInternalSettingsOpen(open);
    onSettingsOpenChange?.(open);
  };
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(settingsOpen, drawerRef);
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsOpen(false); };
    document.addEventListener('keydown', onKey);
    const mobile = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches;
    const prevOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      if (mobile) document.body.style.overflow = prevOverflow;
    };
  }, [settingsOpen]);

  const updateSupplement = (id: string, patch: Partial<Supplement>) => {
    onSave(supplements.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const remove = (id: string) => onSave(supplements.filter((s) => s.id !== id));

  const takenCount = supplements.filter((s) => s.takenToday).length;
  const aiReady = isAiReady(aiAccess);

  const addSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = newName.trim();
    if (!n) return;
    setBusy(true);
    try {
      let info = { name: n, dosage: '', schedule: 'Morning' };
      if (aiReady) {
        try {
          info = await gemini.fetchSupplementInfo(n, aiAccess);
        } catch {
          /* fall back to manual defaults */
        }
      }
      const supp: Supplement = {
        id: rid(),
        name: info.name || n,
        dosage: info.dosage || '',
        schedule: info.schedule || 'Morning',
        takenToday: false,
      };
      onSave([...supplements, supp]);
      setNewName('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add supplement.');
    } finally {
      setBusy(false);
    }
  };

  const checklist = supplements.length === 0 ? (
    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
      Open settings to add your stack{aiReady ? ' — AI can suggest dose & timing.' : '.'}
    </p>
  ) : (
    <div className="dashboard-supplement-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {supplements.map((s, index) => (
        <div
          key={s.id}
          className="motion-stagger"
          style={{ '--i': index, display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.65rem', borderRadius: '12px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' } as React.CSSProperties}
        >
          <button
            type="button"
            data-no-drag
            onClick={() => onToggleTaken(s.id)}
            aria-label={s.takenToday ? `Mark ${s.name} not taken` : `Mark ${s.name} taken`}
            aria-pressed={s.takenToday}
            className={s.takenToday ? 'motion-check-pop' : undefined}
            style={{ width: '26px', height: '26px', flexShrink: 0, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${s.takenToday ? 'var(--accent-teal)' : 'var(--border-glass)'}`, background: s.takenToday ? 'var(--accent-teal)' : 'transparent', color: s.takenToday ? '#fff' : 'var(--text-muted)', transition: 'var(--transition-smooth)' }}
          >
            {s.takenToday && <Check size={15} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{[s.dosage, s.schedule].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const settingsDrawer = settingsOpen && createPortal(
    <div
      className="modal-overlay panel-settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Supplements settings"
      onClick={() => setSettingsOpen(false)}
    >
      <div ref={drawerRef} className="panel-settings-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" aria-hidden />
        <div className="panel-settings-drawer-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
            <Pill size={16} color="var(--accent-purple)" />
            Supplements settings
          </h3>
          <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close" className="btn-icon panel-settings-close">
            <X size={16} />
          </button>
        </div>
        <div className="panel-settings-drawer-body">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Manage your daily stack — dose, schedule, and reminders. Use the dashboard card to check items off.
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
            {supplements.length === 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>No supplements yet — add one below.</p>
            )}
            {supplements.map((s) => (
              <div key={s.id} style={SETTINGS_CARD}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                  <button type="button" onClick={() => remove(s.id)} aria-label={`Remove ${s.name}`} style={iconBtn}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span>Name</span>
                  <input
                    type="text"
                    className="panel-settings-input"
                    value={s.name}
                    onChange={(e) => updateSupplement(s.id, { name: e.target.value })}
                    aria-label={`${s.name} name`}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span>Dosage</span>
                    <input
                      type="text"
                      className="panel-settings-input"
                      value={s.dosage}
                      onChange={(e) => updateSupplement(s.id, { dosage: e.target.value })}
                      placeholder="e.g. 2000 IU"
                      aria-label={`${s.name} dosage`}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span>Schedule</span>
                    <select
                      className="panel-settings-input"
                      value={SCHEDULE_OPTIONS.includes(s.schedule as typeof SCHEDULE_OPTIONS[number]) ? s.schedule : 'Morning'}
                      onChange={(e) => updateSupplement(s.id, { schedule: e.target.value })}
                      aria-label={`${s.name} schedule`}
                    >
                      {SCHEDULE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => void addSupplement(e)} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={aiReady ? 'Add supplement — AI fills dose (e.g. Vitamin D3)' : 'Add supplement (e.g. Vitamin D3)'}
              aria-label="New supplement name"
              disabled={busy}
              className="panel-settings-input"
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="btn btn-primary"
              aria-label="Add supplement"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', opacity: busy || !newName.trim() ? 0.6 : 1 }}
            >
              {aiReady ? <Sparkles size={14} /> : <Plus size={14} />}
              {busy ? '…' : 'Add'}
            </button>
          </form>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.75rem 0 0' }}>
            Reminder times are configured in the Settings tab under Supplement reminders.
          </p>
          {onHidePanel && (
            <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.85rem' }}>
              <button
                type="button"
                onClick={() => { onHidePanel(); setSettingsOpen(false); }}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem', width: '100%' }}
              >
                <EyeOff size={14} /> Hide this panel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  if (embedded) {
    return (
      <>
        {embedded && supplements.length > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>{takenCount}/{supplements.length} taken today</p>
        )}
        {checklist}
        {settingsDrawer}
      </>
    );
  }

  return (
    <>
      <div className="glass-card motion-enter" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Pill size={16} color="var(--accent-purple)" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
            Supplements
          </span>
          {supplements.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{takenCount}/{supplements.length} taken</span>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Supplements settings"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', flexShrink: 0, borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
        {checklist}
      </div>
      {settingsDrawer}
    </>
  );
};

export default SupplementTracker;
