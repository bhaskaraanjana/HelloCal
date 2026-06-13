import React, { useMemo, useState } from 'react';
import type { FavoriteFood } from '../types/nutrition';
import { Search, Plus, Star, Trash2, History } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';

interface RecentsTabProps {
  favorites: FavoriteFood[];
  onQuickLog: (fav: FavoriteFood) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Full, searchable list of previously-logged foods (favorites) — the primary
 * tap-to-log discovery surface beyond the dashboard's 8-chip Quick Add carousel.
 * Sorted pinned-first, then by frequency, then most-recently logged.
 */
export const RecentsTab: React.FC<RecentsTabProps> = ({ favorites, onQuickLog, onTogglePin, onDelete }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...favorites]
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(b.pinned || false) - Number(a.pinned || false) ||
          (b.frequency || 0) - (a.frequency || 0) ||
          (b.lastLogged || 0) - (a.lastLogged || 0)
      );
  }, [favorites, query]);

  if (favorites.length === 0) {
    return (
      <EmptyState
        icon={<History size={28} />}
        title="No foods yet"
        subtitle="Foods you log show up here for one-tap re-logging. Log your first meal to get started."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ position: 'relative' }}>
        <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search your foods"
          placeholder="Search your foods..."
          style={{
            width: '100%',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-glass)',
            borderRadius: '99px',
            padding: '0.7rem 1rem 0.7rem 2.4rem',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem', fontSize: '0.85rem' }}>
          No foods match “{query}”.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map((fav) => (
            <div
              key={fav.id}
              className="glass-card"
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.85rem', borderRadius: '14px' }}
            >
              <button
                type="button"
                onClick={() => onQuickLog(fav)}
                aria-label={`Log ${fav.name}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', flexShrink: 0, borderRadius: '10px', background: 'rgba(139, 92, 246, 0.12)', border: '1px solid var(--border-glass-glow)', color: 'var(--accent-purple)' }}>
                  <Plus size={16} />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fav.name}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {Math.round(fav.calories)} kcal · {fav.quantity}
                    {fav.frequency > 1 ? ` · logged ${fav.frequency}×` : ''}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => onTogglePin(fav.id)}
                aria-label={fav.pinned ? `Unpin ${fav.name}` : `Pin ${fav.name}`}
                aria-pressed={!!fav.pinned}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', flexShrink: 0, borderRadius: '8px', background: fav.pinned ? 'rgba(139,92,246,0.14)' : 'transparent', border: 'none', cursor: 'pointer', color: fav.pinned ? 'var(--accent-purple)' : 'var(--text-muted)' }}
              >
                <Star size={15} fill={fav.pinned ? 'var(--accent-purple)' : 'none'} />
              </button>

              <button
                type="button"
                onClick={() => onDelete(fav.id)}
                aria-label={`Remove ${fav.name} from your foods`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', flexShrink: 0, borderRadius: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentsTab;
