import React, { useState } from 'react';
import type { FavoriteFood } from '../types/nutrition';
import { Zap, Star, Plus } from 'lucide-react';

interface QuickLogBarProps {
  favorites: FavoriteFood[];   // full list; sort by pinned desc, then frequency desc, then lastLogged desc; show top 8
  onQuickLog: (fav: FavoriteFood) => void;   // instantly log this food again
  onTogglePin: (id: string) => void;         // pin/unpin
}

export const QuickLogBar: React.FC<QuickLogBarProps> = ({
  favorites,
  onQuickLog,
  onTogglePin
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!favorites || favorites.length === 0) return null;

  // Sort: pinned desc, then frequency desc, then lastLogged desc; take top 8
  const topFavorites = [...favorites]
    .sort((a, b) => {
      const pinnedDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (pinnedDiff !== 0) return pinnedDiff;
      const freqDiff = (b.frequency || 0) - (a.frequency || 0);
      if (freqDiff !== 0) return freqDiff;
      return (b.lastLogged || 0) - (a.lastLogged || 0);
    })
    .slice(0, 8);

  return (
    <div className="motion-enter" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.15rem' }}>
        <Zap size={15} color="var(--accent-purple)" style={{ filter: 'drop-shadow(0 0 4px var(--accent-purple-glow))' }} />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.72rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--text-secondary)'
        }}>
          Quick Add
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: '0.35rem',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {topFavorites.map((fav, index) => {
          const isHovered = hoveredId === fav.id;
          const isPinned = !!fav.pinned;

          return (
            <div
              key={fav.id}
              className="motion-stagger"
              style={{ '--i': index } as React.CSSProperties}
              onMouseEnter={() => setHoveredId(fav.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(fav.id)}
              onBlur={() => setHoveredId(null)}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexShrink: 0,
                  background: isHovered ? 'var(--bg-glass-hover)' : 'var(--bg-glass)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${isHovered ? 'var(--border-glass-glow)' : 'var(--border-glass)'}`,
                  borderRadius: '16px',
                  padding: '0.5rem 0.65rem 0.5rem 0.85rem',
                  boxShadow: isHovered ? '0 8px 24px 0 rgba(139, 92, 246, 0.14)' : '0 4px 16px 0 rgba(0, 0, 0, 0.25)',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <button
                  type="button"
                  onClick={() => onQuickLog(fav)}
                  aria-label={`Quick log ${fav.name}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '26px',
                    flexShrink: 0,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(139, 92, 246, 0.12)',
                    border: '1px solid var(--border-glass-glow)',
                    color: 'var(--accent-purple)'
                  }}>
                    <Plus size={15} />
                  </span>

                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '0.05rem' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      maxWidth: '130px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {fav.name}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap'
                    }}>
                      {Math.round(fav.calories)} kcal
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onTogglePin(fav.id)}
                  aria-label={isPinned ? `Unpin ${fav.name}` : `Pin ${fav.name}`}
                  aria-pressed={isPinned}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    flexShrink: 0,
                    borderRadius: '8px',
                    background: isPinned ? 'rgba(139, 92, 246, 0.14)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isPinned ? 'var(--accent-purple)' : 'var(--text-muted)',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <Star
                    size={15}
                    fill={isPinned ? 'var(--accent-purple)' : 'none'}
                    style={isPinned ? { filter: 'drop-shadow(0 0 5px var(--accent-purple-glow))' } : undefined}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuickLogBar;
