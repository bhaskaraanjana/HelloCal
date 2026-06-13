import React, { useState, useEffect, useRef } from 'react';
import type { FoodItem } from '../types/nutrition';
import { searchFoods, type FoodDbResult } from '../services/foodDb';
import { Search, X, Plus, Clock } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface FoodSearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when a result is tapped — receives the staged food item to refine/log. */
  onPick: (item: Omit<FoodItem, 'id'>) => void;
}

const RECENTS_KEY = 'hellocal_food_search_recents';

/**
 * Free-text food search against the Open Food Facts database. Debounced, with an
 * AbortController so stale requests never clobber fresh results. Tapping a result
 * stages it for review so the user can adjust the portion before logging.
 */
export const FoodSearchDrawer: React.FC<FoodSearchDrawerProps> = ({ isOpen, onClose, onPick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodDbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, containerRef);

  // Load recent searches and focus the field on open; reset everything on close.
  useEffect(() => {
    if (isOpen) {
      try {
        const raw = localStorage.getItem(RECENTS_KEY);
        setRecents(raw ? JSON.parse(raw) : []);
      } catch {
        setRecents([]);
      }
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    setQuery('');
    setResults([]);
    setError(null);
    setLoading(false);
    abortRef.current?.abort();
  }, [isOpen]);

  // Debounced search. <2 chars clears results so the recents view shows instead.
  useEffect(() => {
    if (!isOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await searchFoods(q, 15, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setResults(r);
        if (r.length === 0) setError('No matches. Try a simpler term, or log it by voice or photo.');
      } catch (e) {
        if ((e as { name?: string })?.name !== 'AbortError') {
          setError('Could not reach the food database. Check your connection.');
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, isOpen]);

  // Escape-to-close + background scroll lock while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const saveRecent = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recents.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    setRecents(next);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  };

  const pick = (result: FoodDbResult) => {
    saveRecent(query);
    onPick(result.item);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Search foods">
      <div
        ref={containerRef}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column', position: 'relative' }}
      >
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{
          padding: '1.1rem 1.5rem 0.85rem',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={18} color="var(--accent-purple)" />
            Search Foods
          </h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close" style={{ borderRadius: '50%', width: '32px', height: '32px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Search field */}
        <div style={{ padding: '0.85rem 1.25rem' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a food or brand (e.g. greek yogurt)..."
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-glass)',
                borderRadius: '99px',
                padding: '0.7rem 1rem 0.7rem 2.4rem',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            {loading && (
              <div style={{
                position: 'absolute',
                right: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: '2px solid var(--accent-purple)',
                borderTopColor: 'transparent',
                animation: 'spin 1s linear infinite',
              }} />
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.25rem 1.25rem' }}>
          {/* Recents (shown when no active query) */}
          {query.trim().length < 2 && recents.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {recents.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-label={`Recent search: ${r}`}
                  onClick={() => setQuery(r)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '99px',
                    padding: '0.35rem 0.75rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <Clock size={12} /> {r}
                </button>
              ))}
            </div>
          )}

          {query.trim().length < 2 && recents.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Type at least 2 letters to search millions of foods from the Open Food Facts database.
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 1rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {results.map((r, i) => (
              <button
                key={`${r.barcode || r.item.name}_${i}`}
                type="button"
                onClick={() => pick(r)}
                className="glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {r.item.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    {Math.round(r.item.calories)} kcal · {r.item.quantity} · {Math.round(r.item.protein)}P / {Math.round(r.item.carbs)}C / {Math.round(r.item.fat)}F
                  </div>
                </div>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  flexShrink: 0,
                  borderRadius: '10px',
                  background: 'rgba(139, 92, 246, 0.12)',
                  border: '1px solid var(--border-glass-glow)',
                  color: 'var(--accent-purple)',
                }}>
                  <Plus size={16} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodSearchDrawer;
