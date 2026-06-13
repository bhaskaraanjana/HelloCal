import React from 'react';
import { Droplet, Droplets, Plus, RotateCcw } from 'lucide-react';

export interface WaterTrackerProps {
  todayMl: number;      // already-summed water consumed today
  targetMl: number;     // daily target in ml
  onAdd: (ml: number) => void;   // log this many ml
  onUndo: () => void;            // remove the most recent entry of today
}

const WATER_COLOR = 'var(--accent-blue)';
const WATER_GLOW = 'var(--accent-blue-glow)';

const QUICK_ADDS: { label: string; ml: number; icon: React.ReactNode }[] = [
  { label: 'Add a cup of water (200 ml)', ml: 200, icon: <Droplet size={16} /> },
  { label: 'Add 250 ml of water', ml: 250, icon: <Plus size={16} /> },
  { label: 'Add 500 ml of water', ml: 500, icon: <Droplets size={16} /> },
];

export const WaterTracker: React.FC<WaterTrackerProps> = ({
  todayMl,
  targetMl,
  onAdd,
  onUndo,
}) => {
  const safeTarget = targetMl > 0 ? targetMl : 1;
  const ratio = todayMl / safeTarget;
  const percent = Math.round(ratio * 100);
  const fillPercent = Math.min(Math.max(ratio, 0), 1) * 100; // capped visual

  // Ring geometry
  const size = 132;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const dashOffset = circumference - (Math.min(Math.max(ratio, 0), 1)) * circumference;

  const isEmpty = todayMl === 0;

  return (
    <div
      className="glass-card"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        border: '1px solid rgba(6, 182, 212, 0.15)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            color: WATER_COLOR,
            boxShadow: `0 0 14px ${WATER_GLOW}`,
          }}
        >
          <Droplet size={20} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.1,
            }}
          >
            Hydration
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}
          >
            {todayMl} / {targetMl} ml
          </span>
        </div>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-display)',
            fontSize: '1.15rem',
            fontWeight: 700,
            color: WATER_COLOR,
            textShadow: `0 0 12px ${WATER_GLOW}`,
          }}
        >
          {percent}%
        </span>
      </div>

      {/* Progress ring with a "glass filling" core */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={size}
            height={size}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={WATER_COLOR}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 6px ${WATER_GLOW})`,
                transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </svg>

          {/* Inner glass-filling visual */}
          <div
            style={{
              position: 'absolute',
              width: size - strokeWidth * 2 - 12,
              height: size - strokeWidth * 2 - 12,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '1px solid var(--border-glass)',
              background: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${fillPercent}%`,
                background: `linear-gradient(to top, ${WATER_COLOR}, ${WATER_GLOW})`,
                boxShadow: `0 0 18px ${WATER_GLOW}`,
                transition: 'height 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {todayMl}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                }}
              >
                ml today
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick-add + Undo controls */}
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'stretch' }}>
        {QUICK_ADDS.map(({ label, ml, icon }) => (
          <button
            key={ml}
            type="button"
            onClick={() => onAdd(ml)}
            aria-label={label}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
              padding: '0.7rem 0.4rem',
              borderRadius: 14,
              border: '1px solid rgba(6, 182, 212, 0.2)',
              background: 'rgba(6, 182, 212, 0.08)',
              color: WATER_COLOR,
              fontFamily: 'var(--font-display)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-smooth)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(6, 182, 212, 0.16)';
              e.currentTarget.style.boxShadow = `0 0 14px ${WATER_GLOW}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {icon}
            <span>+{ml}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={onUndo}
          disabled={isEmpty}
          aria-label="Undo most recent water entry"
          className="btn-icon"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            borderRadius: 14,
            cursor: isEmpty ? 'not-allowed' : 'pointer',
            opacity: isEmpty ? 0.4 : 1,
            color: 'var(--text-secondary)',
            transition: 'var(--transition-smooth)',
          }}
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
};

export default WaterTracker;
