import React, { useState, useId } from 'react';
import type { HydrationLog, UserGoals } from '../types/nutrition';
import { Plus, Minus, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface HydrationTrackerProps {
  logs: HydrationLog[];
  goals: UserGoals;
  onAddWater: (amount: number) => void;
  onRemoveWater: (id: string) => void;
  noCardShell?: boolean;
}

const QUICK_ADDS = [
  { ml: 250, label: '250ml', hint: 'Glass' },
  { ml: 500, label: '500ml', hint: 'Bottle' },
  { ml: 750, label: '750ml', hint: 'Large' },
] as const;

const DROP_VIEW_H = 120;

/** SVG teardrop with animated fill — clip path keeps liquid inside the drop shape. */
const HydrationDropVisual: React.FC<{
  fillPercent: number;
  consumedWater: number;
  isSplashing: boolean;
}> = ({ fillPercent, consumedWater, isSplashing }) => {
  const rawId = useId();
  const clipId = `hydration-clip-${rawId.replace(/:/g, '')}`;
  const gradId = `hydration-water-gradient-${rawId.replace(/:/g, '')}`;
  const liquidY = DROP_VIEW_H * (1 - fillPercent / 100);

  return (

    <div className={`hydration-drop${isSplashing ? ' hydration-drop--splash' : ''}`} aria-hidden>
      <div className="hydration-drop__glow" />
      <span className="hydration-drop__orb hydration-drop__orb--1" />
      <span className="hydration-drop__orb hydration-drop__orb--2" />
      <span className="hydration-drop__orb hydration-drop__orb--3" />
      <svg className="hydration-drop__svg" viewBox="0 0 100 120" role="presentation">
        <defs>
          <clipPath id={clipId}>
            <path d="M50 6 C50 6 14 58 14 86 A36 36 0 1 0 86 86 C86 58 50 6 50 6 Z" />
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="45%" stopColor="var(--hydration-color)" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        <path
          className="hydration-drop__outline"
          d="M50 6 C50 6 14 58 14 86 A36 36 0 1 0 86 86 C86 58 50 6 50 6 Z"
        />
        <g clipPath={`url(#${clipId})`}>
          <g className="hydration-drop__liquid" style={{ transform: `translateY(${liquidY}px)` }}>
            <rect fill={`url(#${gradId})`} x="-8" y="-16" width="116" height={DROP_VIEW_H + 24} />
            {fillPercent > 0 && (
              <g style={{ transform: 'translateY(-14px)' }}>
                <path
                  className="hydration-drop__wave"
                  d="M0 8 C20 0 20 16 40 8 C60 0 60 16 80 8 C100 0 100 16 120 8 L120 20 L0 20 Z"
                  style={{ transform: 'scaleX(1.35)' }}
                />
              </g>
            )}
          </g>
          <ellipse className="hydration-drop__shine" cx="36" cy="42" rx="9" ry="22" transform="rotate(-18 36 42)" />
        </g>
      </svg>
      <div className="hydration-drop__label">
        <strong>{Math.round(fillPercent)}%</strong>
        <span>{consumedWater.toLocaleString()} ml</span>
      </div>
    </div>

  );
};

export const HydrationTracker: React.FC<HydrationTrackerProps> = ({
  logs,
  goals,
  onAddWater,
  onRemoveWater,
  noCardShell = false,
}) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customVal, setCustomVal] = useState('250');
  const [isSplashing, setIsSplashing] = useState(false);

  const targetAmount = goals.hydration || 2000;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfToday = today.getTime();
  const todayLogs = logs.filter((log) => log.timestamp >= startOfToday);
  const lastLog = [...todayLogs].sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
  const consumedWater = todayLogs.reduce((sum, entry) => sum + entry.amount, 0);
  const fillPercent = Math.min((consumedWater / targetAmount) * 100, 100);
  const isGoalAchieved = consumedWater >= targetAmount;

  const dragGuard = noCardShell ? ({ 'data-no-drag': '' } as const) : {};

  const handleAddAmount = (amount: number) => {
    setIsSplashing(true);
    onAddWater(amount);
    setTimeout(() => setIsSplashing(false), 800);

    if (consumedWater < targetAmount && consumedWater + amount >= targetAmount) {
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 60,
          colors: ['#06b6d4', '#8b5cf6', '#10b981'],
          origin: { y: 0.6 },
        });
      }, 200);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customVal, 10);
    if (!isNaN(val) && val > 0) {
      handleAddAmount(val);
      setShowCustom(false);
    }
  };

  const rootClass = [
    'hydration-tracker',
    noCardShell ? '' : 'hydration-tracker--standalone glass-card motion-enter',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      style={noCardShell ? undefined : {
        padding: '1.75rem',
        position: 'relative',
        backdropFilter: 'blur(24px)',
        border: '1.5px solid rgba(255, 255, 255, 0.09)',
        background: 'rgba(19, 21, 32, 0.6)',
        boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.55)',
      }}
    >
      {!noCardShell && (
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          color: 'var(--hydration-color)',
          fontSize: '0.85rem',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--hydration-color)" strokeWidth="2.2" aria-hidden>
            <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-13-7-13S5 10.7 5 15a7 7 0 0 0 7 7z" />
          </svg>
          <span>Water Tracker</span>
        </div>
      )}

      <div className="hydration-tracker-layout" style={noCardShell ? undefined : { marginTop: '1.5rem' }}>
        <div className="hydration-tracker-controls">
          <div className="hydration-tracker-summary">
            <span className="hydration-tracker-amount">{consumedWater.toLocaleString()} ml</span>
            <span className="hydration-tracker-target">of {targetAmount.toLocaleString()} ml goal</span>
            <div className="hydration-tracker-progress" aria-hidden>
              <div className="hydration-tracker-progress-fill" style={{ width: `${fillPercent}%` }} />
            </div>
          </div>

          {isGoalAchieved && (
            <div className="hydration-tracker-goal-pill">
              <Check size={12} aria-hidden />
              <span>Daily goal met</span>
            </div>
          )}

          <div className="hydration-tracker-actions">
            {!showCustom ? (
              <>
                {QUICK_ADDS.map(({ ml, label, hint }) => (
                  <button
                    key={ml}
                    type="button"
                    className="hydration-tracker-add-btn"
                    {...dragGuard}
                    onClick={() => handleAddAmount(ml)}
                    aria-label={`Add ${label}`}
                  >
                    <span><Plus size={11} aria-hidden /> {label}</span>
                    <span>{hint}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="hydration-tracker-add-btn hydration-tracker-add-btn--ghost"
                  {...dragGuard}
                  onClick={() => setShowCustom(true)}
                >
                  + Custom
                </button>
              </>
            ) : (
              <form className="hydration-tracker-custom-form" onSubmit={handleCustomSubmit}>
                <input
                  type="number"
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  placeholder="ml"
                  aria-label="Custom amount in ml"
                  autoFocus
                />
                <button type="submit" className="btn btn-primary" {...dragGuard} aria-label="Add" style={{ padding: '0.45rem 0.65rem' }}>
                  <Check size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  {...dragGuard}
                  onClick={() => setShowCustom(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          {lastLog && (
            <button
              type="button"
              className="hydration-tracker-undo"
              {...dragGuard}
              title="Remove last log"
              onClick={() => onRemoveWater(lastLog.id)}
            >
              <Minus size={13} aria-hidden />
              Undo last ({lastLog.amount} ml)
            </button>
          )}
        </div>

        <div className="hydration-tracker-visual">
          <HydrationDropVisual
            fillPercent={fillPercent}
            consumedWater={consumedWater}
            isSplashing={isSplashing}
          />
        </div>
      </div>
    </div>
  );
};
export default HydrationTracker;
