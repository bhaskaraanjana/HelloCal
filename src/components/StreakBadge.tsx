import React from 'react';
import { Flame } from 'lucide-react';

interface StreakBadgeProps {
  streak: number;      // consecutive logging days
  totalDays: number;   // lifetime distinct logged days
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ streak, totalDays }) => {
  const isActive = streak > 0;
  const isHot = streak >= 7;

  // Flame color shifts with streak intensity.
  const flameColor = !isActive
    ? 'var(--text-muted)'
    : isHot
      ? 'var(--accent-rose)'
      : 'var(--accent-amber)';

  const flameGlow = !isActive
    ? 'transparent'
    : isHot
      ? 'var(--accent-rose-glow)'
      : 'var(--accent-amber-glow)';

  // Subtle pill glow that intensifies for hot streaks.
  const pillShadow = !isActive
    ? '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
    : isHot
      ? `0 8px 32px 0 rgba(0, 0, 0, 0.3), 0 0 24px var(--accent-amber-glow), inset 0 0 14px var(--accent-rose-glow)`
      : `0 8px 32px 0 rgba(0, 0, 0, 0.3), 0 0 12px var(--accent-amber-glow)`;

  return (
    <div
      className="glass-card"
      role="status"
      aria-label={
        isActive
          ? `${streak} day logging streak. ${totalDays} days logged all-time.`
          : `No active streak. ${totalDays} days logged all-time.`
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.9rem',
        padding: '0.85rem 1.1rem',
        borderRadius: '16px',
        minWidth: 0,
        boxShadow: pillShadow,
        border: isHot ? '1px solid var(--accent-amber-glow)' : '1px solid var(--border-glass)',
        transition: 'var(--transition-spring)'
      }}
    >
      {/* Flame badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '42px',
          height: '42px',
          flexShrink: 0,
          borderRadius: '12px',
          background: isActive ? `radial-gradient(circle at 50% 60%, ${flameGlow}, transparent 70%)` : 'rgba(255,255,255,0.03)',
          boxShadow: isActive ? `inset 0 0 12px ${flameGlow}` : 'none',
          transition: 'var(--transition-spring)'
        }}
      >
        <Flame
          size={24}
          color={flameColor}
          strokeWidth={2.2}
          fill={isHot ? flameColor : 'transparent'}
          style={{
            filter: isActive ? `drop-shadow(0 0 6px ${flameGlow})` : 'none',
            transition: 'var(--transition-spring)'
          }}
          aria-hidden="true"
        />
      </div>

      {/* Text content */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.1 }}>
        {isActive ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.6rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em'
              }}
            >
              {streak}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.82rem',
                fontWeight: 500,
                color: 'var(--text-secondary)'
              }}
            >
              day streak
            </span>
          </div>
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap'
            }}
          >
            Start your streak today
          </span>
        )}

        {/* Secondary all-time line */}
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.72rem',
            fontWeight: 400,
            color: 'var(--text-muted)',
            marginTop: '0.15rem',
            whiteSpace: 'nowrap'
          }}
        >
          {totalDays} days logged all-time
        </span>
      </div>
    </div>
  );
};

export default StreakBadge;
