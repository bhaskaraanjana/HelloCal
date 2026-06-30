import React, { useState, useEffect } from 'react';
import type { HydrationLog, UserGoals } from '../types/nutrition';
import { Droplet, Plus, Minus, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface HydrationTrackerProps {
  logs: HydrationLog[];
  goals: UserGoals;
  onAddWater: (amount: number) => void;
  onRemoveWater: (id: string) => void;
  noCardShell?: boolean;
}

interface Bubble {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
}

export const HydrationTracker: React.FC<HydrationTrackerProps> = ({
  logs,
  goals,
  onAddWater,
  onRemoveWater,
  noCardShell = false
}) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customVal, setCustomVal] = useState('250');
  const [isSplashing, setIsSplashing] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  // Generate bubbles on mount
  useEffect(() => {
    const list = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 88 + 6, // 6% to 94%
      delay: Math.random() * 5,
      duration: 4 + Math.random() * 5,
      size: 4 + Math.random() * 5
    }));
    setBubbles(list);
  }, []);

  const targetAmount = goals.hydration || 2000;

  // Filter logs for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfToday = today.getTime();
  const todayLogs = logs.filter(log => log.timestamp >= startOfToday);

  // Sum water logged today
  const consumedWater = todayLogs.reduce((sum, entry) => sum + entry.amount, 0);

  const fillPercent = Math.min((consumedWater / targetAmount) * 100, 100);
  const isGoalAchieved = consumedWater >= targetAmount;

  const handleAddAmount = (amount: number) => {
    setIsSplashing(true);
    onAddWater(amount);
    
    // Splash animation duration
    setTimeout(() => {
      setIsSplashing(false);
    }, 800);

    // If goal newly achieved, confetti!
    if (consumedWater < targetAmount && consumedWater + amount >= targetAmount) {
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 60,
          colors: ['#06b6d4', '#8b5cf6', '#10b981'],
          origin: { y: 0.6 }
        });
      }, 200);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customVal);
    if (!isNaN(val) && val > 0) {
      handleAddAmount(val);
      setShowCustom(false);
    }
  };

    return (
    <div className={noCardShell ? "" : "glass-card"} style={noCardShell ? {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '320px',
      gap: '1.25rem',
      width: '100%'
    } : {
      padding: '2rem 1.75rem',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '420px',
      gap: '1.25rem',
      backdropFilter: 'blur(24px)',
      border: '1.5px solid rgba(255, 255, 255, 0.09)',
      background: 'rgba(19, 21, 32, 0.6)',
      boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.55)'
    }}>

      {/* Header Deck */}
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
          fontWeight: 600
        }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--hydration-color)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 0 5px var(--hydration-color-glow))',
              animation: 'float 3.5s ease-in-out infinite'
            }}
          >
            <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-13-7-13S5 10.7 5 15a7 7 0 0 0 7 7z" />
            <path d="M12 18a3 3 0 0 0 3-3c0-2-3-6-3-6s-3 4-3 6a3 3 0 0 0 3 3z" fill="var(--hydration-color)" opacity="0.35" />
          </svg>
          <span>FLUID H2O GLOW INDEX</span>
        </div>
      )}

      {/* Water Bottle Structure (Cap, Collar, Body) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1.25rem', position: 'relative' }}>
        {/* Bottle Cap */}
        <div style={{
          width: '40px',
          height: '14px',
          background: 'linear-gradient(90deg, #334155, #475569)',
          border: '1.5px solid rgba(255, 255, 255, 0.15)',
          borderBottom: 'none',
          borderRadius: '6px 6px 0 0',
          boxShadow: '0 0 10px rgba(56, 189, 248, 0.1)',
          zIndex: 5
        }} />
        {/* Bottle Collar/Neck */}
        <div style={{
          width: '56px',
          height: '8px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '2px solid rgba(255, 255, 255, 0.08)',
          borderBottom: 'none',
          borderRadius: '3px 3px 0 0',
          zIndex: 4
        }} />
        
        {/* Main Bottle Body */}
        <div 
          className={`glass-beaker-wrapper ${isSplashing ? 'beaker-splash' : ''}`}
          style={{
            width: '124px',
            height: '210px',
            position: 'relative',
            borderRadius: '12px 12px 24px 24px',
            border: '3px solid rgba(255, 255, 255, 0.08)',
            background: 'radial-gradient(circle at center, rgba(56, 189, 248, 0.03), transparent 75%), rgba(255, 255, 255, 0.01)',
            boxShadow: 'inset 0 0 35px rgba(56, 189, 248, 0.12), 0 12px 35px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            marginTop: '0px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            zIndex: 1
          }}
        >
          {/* Glass vertical shine highlights */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '12px',
            width: '8px',
            height: '100%',
            background: 'linear-gradient(to right, rgba(255,255,255,0.08), transparent)',
            pointerEvents: 'none',
            zIndex: 4
          }} />
          <div style={{
            position: 'absolute',
            top: 0,
            right: '12px',
            width: '4px',
            height: '100%',
            background: 'linear-gradient(to left, rgba(255,255,255,0.05), transparent)',
            pointerEvents: 'none',
            zIndex: 4
          }} />

          {/* Shifting Wave Elements at liquid top surface */}
          {fillPercent > 0 && (
            <>
              {/* Primary Wave Path */}
              <svg 
                className="rolling-wave wave-primary" 
                viewBox="0 0 100 20" 
                preserveAspectRatio="none"
                style={{
                  position: 'absolute',
                  bottom: '99%',
                  left: 0,
                  width: '200%',
                  height: '18px',
                  fill: 'var(--hydration-color)',
                  opacity: 0.85,
                  zIndex: 3
                }}
              >
                <path d="M 0 10 C 25 2, 25 18, 50 10 C 75 2, 75 18, 100 10 C 125 2, 125 18, 150 10 C 175 2, 175 18, 200 10 L 200 20 L 0 20 Z" />
              </svg>

              {/* Secondary Overlay Wave Path */}
              <svg 
                className="rolling-wave wave-secondary" 
                viewBox="0 0 100 20" 
                preserveAspectRatio="none"
                style={{
                  position: 'absolute',
                  bottom: '99%',
                  left: 0,
                  width: '200%',
                  height: '18px',
                  fill: 'var(--hydration-color)',
                  opacity: 0.45,
                  zIndex: 3
                }}
              >
                <path d="M 0 10 C 25 18, 25 2, 50 10 C 75 18, 75 2, 100 10 C 125 18, 125 2, 150 10 C 175 18, 175 2, 200 10 L 200 20 L 0 20 Z" />
              </svg>
            </>
          )}

          {/* Floating Bubble Particles */}
          {fillPercent > 0 && bubbles.map((b) => (
            <div 
              key={b.id}
              className="hydration-bubble"
              style={{
                position: 'absolute',
                left: `${b.x}%`,
                bottom: '-20px',
                width: `${b.size}px`,
                height: `${b.size}px`,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.35)',
                boxShadow: '0 0 6px rgba(255, 255, 255, 0.2)',
                animation: `bubble-float ${b.duration}s linear infinite`,
                animationDelay: `${b.delay}s`,
                pointerEvents: 'none',
                zIndex: 2
              }}
            />
          ))}

          {/* Main Liquid Body fill */}
          <div 
            className="liquid-filling-body"
            style={{
              height: '100%',
              width: '100%',
              transform: `scaleY(${fillPercent / 100})`,
              transformOrigin: 'center bottom',
              backgroundColor: 'var(--hydration-color)',
              boxShadow: '0 0 40px var(--hydration-color-glow)',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              zIndex: 2
            }}
          />

          {/* Glowing Percentage HUD Text Overlay */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 5,
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)'
          }}>
            <span style={{
              fontSize: '2rem',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: '#fff',
              lineHeight: 1,
              filter: 'drop-shadow(0 0 8px var(--hydration-color))'
            }}>
              {Math.round(fillPercent)}%
            </span>
            <span style={{
              fontSize: '0.7rem',
              color: 'rgba(255, 255, 255, 0.7)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginTop: '0.2rem'
            }}>
              {consumedWater} / {targetAmount} ml
            </span>
          </div>

        </div>
      </div>

      {/* Goal achievement feedback pill */}
      {isGoalAchieved && (
        <div style={{
          padding: '0.4rem 0.85rem',
          borderRadius: '16px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          color: 'var(--accent-teal)',
          fontSize: '0.8rem',
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          marginTop: '0.25rem'
        }}>
          <Check size={14} />
          <span>DAILY HYDRATION HALO MET</span>
        </div>
      )}

      {/* Quick Increment Add Buttons Deck */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        width: '100%',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginTop: '0.5rem'
      }}>
        {!showCustom ? (
          <>
            <button
              className="btn btn-secondary"
              onClick={() => handleAddAmount(250)}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Plus size={12} />
              <span>250ml</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleAddAmount(500)}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Plus size={12} />
              <span>500ml</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleAddAmount(750)}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Plus size={12} />
              <span>750ml</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowCustom(true)}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                background: 'rgba(255, 255, 255, 0.01)',
                color: 'var(--text-secondary)'
              }}
            >
              <span>+ Custom</span>
            </button>
          </>
        ) : (
          <form onSubmit={handleCustomSubmit} style={{
            display: 'flex',
            gap: '0.4rem',
            alignItems: 'center',
            width: '100%',
            maxWidth: '240px',
            animation: 'fadeSlideIn 0.3s ease'
          }}>
            <input
              type="number"
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value)}
              placeholder="ml"
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                color: '#fff',
                outline: 'none',
                textAlign: 'center'
              }}
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '0.45rem',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '32px'
              }}
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setShowCustom(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem'
              }}
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* Styled class selectors for wave roll animations inside Dashboard */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes wave-slide-1 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes wave-slide-2 {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        @keyframes bubble-float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-240px) scale(0.6); opacity: 0; }
        }
        .rolling-wave {
          transform-origin: center bottom;
        }
        .wave-primary {
          animation: wave-slide-1 12s linear infinite;
        }
        .wave-secondary {
          animation: wave-slide-2 8s linear infinite;
        }
        .beaker-splash {
          animation: splash-scale 0.6s cubic-bezier(0.16, 1, 0.3, 1) 1;
        }
        @keyframes splash-scale {
          0% { transform: scale(1); }
          30% { transform: scale(1.06) translateY(-4px); }
          70% { transform: scale(0.96) translateY(2px); }
          100% { transform: scale(1); }
        }
      `}} />

    </div>
  );
};
export default HydrationTracker;
