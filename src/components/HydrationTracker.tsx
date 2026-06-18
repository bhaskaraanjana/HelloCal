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
      gap: '1.25rem'
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
          <Droplet size={16} fill="var(--hydration-color)" style={{ animation: 'float 3s infinite' }} />
          <span>FLUID H2O GLOW INDEX</span>
        </div>
      )}

      {/* Main Beaker Frame & Animations */}
      <div 
        className={`glass-beaker-wrapper ${isSplashing ? 'beaker-splash' : ''}`}
        style={{
          width: '160px',
          height: '240px',
          position: 'relative',
          borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-pill) var(--radius-pill)',
          border: '3px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.015)',
          boxShadow: 'inset 0 0 20px rgba(255, 255, 255, 0.05), 0 10px 30px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          marginTop: '1.5rem',
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

        {/* Liquid Body filling block */}
        <div 
          className="liquid-filling-body"
          style={{
            height: '100%',
            width: '100%',
            transform: `scaleY(${fillPercent / 100})`,
            transformOrigin: 'bottom',
            backgroundColor: 'var(--hydration-color)',
            boxShadow: '0 0 40px var(--hydration-color-glow)',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 2
          }}
        >
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
                bottom: 0,
                width: `${b.size}px`,
                height: `${b.size}px`,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.4)',
                boxShadow: '0 0 4px rgba(255,255,255,0.6)',
                animation: `bubble-rise ${b.duration}s linear infinite`,
                animationDelay: `${b.delay}s`,
                pointerEvents: 'none',
                zIndex: 2
              }}
            />
          ))}
        </div>

        {/* Center overlay numeric percentage indicator */}
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
          textShadow: '0 2px 8px rgba(0,0,0,0.6)'
        }}>
          <span style={{
            fontSize: '2rem',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            color: '#fff',
            lineHeight: 1
          }}>
            {Math.round(fillPercent)}%
          </span>
          <span style={{
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.7)',
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
          animation: 'pulseBorder 2s infinite'
        }}>
          <Check size={14} />
          <span>DAILY HYDRATION HALO MET</span>
        </div>
      )}

      {/* Quick Add Logging deck */}
      {!showCustom ? (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          width: '100%',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginTop: '0.5rem'
        }}>
          <button 
            onClick={() => handleAddAmount(250)}
            className="btn btn-secondary" 
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <Plus size={12} />
            <span>250ml</span>
          </button>
          
          <button 
            onClick={() => handleAddAmount(500)}
            className="btn btn-secondary" 
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <Plus size={12} />
            <span>500ml</span>
          </button>

          <button 
            onClick={() => handleAddAmount(750)}
            className="btn btn-secondary" 
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <Plus size={12} />
            <span>750ml</span>
          </button>

          <button 
            onClick={() => setShowCustom(true)}
            className="btn btn-secondary" 
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.01)',
              color: 'var(--text-secondary)'
            }}
          >
            <span>+ Custom</span>
          </button>

          {/* Quick Undo entry button */}
          {todayLogs.length > 0 && (
            <button
              onClick={() => onRemoveWater(todayLogs[todayLogs.length - 1].id)}
              title="Remove last log"
              aria-label="Remove last water log"
              style={{
                padding: '0.45rem',
                fontSize: '0.8rem',
                borderRadius: '12px',
                border: '1px solid rgba(244,63,94,0.15)',
                background: 'rgba(244,63,94,0.03)',
                color: 'var(--accent-rose)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition-smooth)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244,63,94,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(244,63,94,0.03)'}
              onFocus={(e) => e.currentTarget.style.background = 'rgba(244,63,94,0.1)'}
              onBlur={(e) => e.currentTarget.style.background = 'rgba(244,63,94,0.03)'}
            >
              <Minus size={12} />
            </button>
          )}
        </div>
      ) : (
        /* Custom Amount input form inline expansion */
        <form 
          onSubmit={handleCustomSubmit} 
          style={{
            display: 'flex', 
            gap: '0.5rem', 
            width: '100%', 
            justifyContent: 'center',
            marginTop: '0.5rem',
            animation: 'float 0.3s ease-out'
          }}
        >
          <input 
            type="number"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            autoFocus
            style={{
              width: '80px',
              padding: '0.45rem 0.75rem',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
              borderRadius: '12px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              textAlign: 'center',
              outline: 'none'
            }}
          />
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>ml</span>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', borderRadius: '12px' }}
          >
            Add
          </button>
          <button 
            type="button" 
            onClick={() => setShowCustom(false)}
            className="btn btn-secondary" 
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', borderRadius: '12px' }}
          >
            Cancel
          </button>
        </form>
      )}

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
