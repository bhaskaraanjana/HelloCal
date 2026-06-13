import React, { useState } from 'react';
import type { Supplement } from '../types/nutrition';
import { gemini } from '../services/gemini';
import { Pill, Plus, Check, Trash2, Sparkles } from 'lucide-react';

interface SupplementTrackerProps {
  supplements: Supplement[];
  apiKey: string;
  onSave: (supplements: Supplement[]) => void;
  onToggleTaken: (id: string) => void;
  onError: (msg: string) => void;
}

const rid = () => `supp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * Daily supplement/stack tracker. Add by name — if a Gemini key is set, the AI
 * fills in standard dosage + schedule; otherwise it's added with sensible
 * defaults. "Taken today" flags reset each day (handled by the app on load).
 */
export const SupplementTracker: React.FC<SupplementTrackerProps> = ({ supplements, apiKey, onSave, onToggleTaken, onError }) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const addSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      let info = { name: n, dosage: '', schedule: 'Morning' };
      if (apiKey) {
        try {
          info = await gemini.fetchSupplementInfo(n, apiKey);
        } catch {
          /* fall back to manual defaults below */
        }
      }
      const supp: Supplement = { id: rid(), name: info.name || n, dosage: info.dosage || '', schedule: info.schedule || 'Morning', takenToday: false };
      onSave([...supplements, supp]);
      setName('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add supplement.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => onSave(supplements.filter((s) => s.id !== id));

  const takenCount = supplements.filter((s) => s.takenToday).length;

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Pill size={16} color="var(--accent-purple)" />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
          Supplements
        </span>
        {supplements.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{takenCount}/{supplements.length} taken</span>
        )}
      </div>

      {supplements.length === 0 && (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
          Track your daily stack. Add a supplement{apiKey ? ' — AI fills in the standard dose & timing.' : '.'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {supplements.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.65rem', borderRadius: '12px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <button
              type="button"
              onClick={() => onToggleTaken(s.id)}
              aria-label={s.takenToday ? `Mark ${s.name} not taken` : `Mark ${s.name} taken`}
              aria-pressed={s.takenToday}
              style={{ width: '26px', height: '26px', flexShrink: 0, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${s.takenToday ? 'var(--accent-teal)' : 'var(--border-glass)'}`, background: s.takenToday ? 'var(--accent-teal)' : 'transparent', color: s.takenToday ? '#fff' : 'var(--text-muted)' }}
            >
              {s.takenToday && <Check size={15} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{[s.dosage, s.schedule].filter(Boolean).join(' · ')}</div>
            </div>
            <button type="button" onClick={() => remove(s.id)} aria-label={`Remove ${s.name}`} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={addSupplement} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a supplement (e.g. Vitamin D3)"
          aria-label="Supplement name"
          disabled={busy}
          style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.55rem 0.8rem', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
        />
        <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary" aria-label="Add supplement" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0 0.9rem', fontSize: '0.82rem', opacity: busy || !name.trim() ? 0.6 : 1 }}>
          {apiKey ? <Sparkles size={14} /> : <Plus size={14} />}
          {busy ? '…' : 'Add'}
        </button>
      </form>
    </div>
  );
};

export default SupplementTracker;
