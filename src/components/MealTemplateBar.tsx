import React, { useState } from 'react';
import type { MealTemplate } from '../types/nutrition';
import { BookmarkCheck, X } from 'lucide-react';

interface MealTemplateBarProps {
  templates: MealTemplate[];
  onApply: (t: MealTemplate) => void;   // re-log every item in the preset in one tap
  onDelete: (id: string) => void;
}

const kcalOf = (t: MealTemplate) =>
  Math.round(t.items.reduce((s, i) => s + (Number(i.calories) || 0), 0));

export const MealTemplateBar: React.FC<MealTemplateBarProps> = ({ templates, onApply, onDelete }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!templates || templates.length === 0) return null;

  const ordered = [...templates].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.15rem' }}>
        <BookmarkCheck size={15} color="var(--accent-teal)" style={{ filter: 'drop-shadow(0 0 4px var(--accent-teal-glow))' }} />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.72rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--text-secondary)',
        }}>
          Meal Presets
        </span>
      </div>

      <div style={{
        display: 'flex',
        gap: '0.6rem',
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: '0.35rem',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {ordered.map((t) => {
          const isHovered = hoveredId === t.id;
          return (
            <div
              key={t.id}
              onMouseEnter={() => setHoveredId(t.id)}
              onMouseLeave={() => setHoveredId(null)}
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
                padding: '0.5rem 0.6rem 0.5rem 0.85rem',
                boxShadow: isHovered ? '0 8px 24px 0 rgba(6, 182, 212, 0.14)' : '0 4px 16px 0 rgba(0, 0, 0, 0.25)',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                transition: 'var(--transition-smooth)',
              }}
            >
              <button
                type="button"
                onClick={() => onApply(t)}
                aria-label={`Log preset ${t.name}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.05rem',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  minWidth: 0,
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  maxWidth: '150px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {t.name}
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {t.items.length} item{t.items.length === 1 ? '' : 's'} · {kcalOf(t)} kcal
                </span>
              </button>

              <button
                type="button"
                onClick={() => onDelete(t.id)}
                aria-label={`Delete preset ${t.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  transition: 'var(--transition-smooth)',
                }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MealTemplateBar;
