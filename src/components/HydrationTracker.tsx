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
    <div data-impeccable-variants="991dd7d7" data-impeccable-variant-count="3" style={{ display: "contents" }}>
      {/* impeccable-variants-start 991dd7d7 */}
      {/* Original */}
      <div data-impeccable-variant="original">
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
      </div>
      {/* Variants: insert below this line */}
      <div data-impeccable-variant="1">
        <style data-impeccable-css="991dd7d7">{`
          @scope ([data-impeccable-variant="1"]) {
            :scope > .glass-card {
              background: radial-gradient(circle at top right, rgba(56, 189, 248, 0.04), transparent 70%), rgba(19, 21, 32, 0.8) !important;
              border: 1px solid rgba(56, 189, 248, 0.16) !important;
              box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.45), 0 0 15px rgba(56, 189, 248, 0.05) !important;
            }
            :scope .glass-beaker-wrapper {
              border: 3px solid rgba(56, 189, 248, 0.3) !important;
              background: rgba(56, 189, 248, 0.01) !important;
            }
            :scope .btn-secondary {
              border-color: rgba(56, 189, 248, 0.08) !important;
              transition: var(--transition-smooth) !important;
            }
            :scope .btn-secondary:hover {
              border-color: rgba(56, 189, 248, 0.3) !important;
              box-shadow: 0 0 8px rgba(56, 189, 248, 0.15) !important;
            }
          }
        `}</style>
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
            {/* Graduated lines/ticks inside beaker for Tactical HUD Console variant */}
            <div style={{ position: 'absolute', left: '10px', top: '15%', display: 'flex', flexDirection: 'column', gap: '22px', zIndex: 4, opacity: 0.25 }}>
              {[80, 60, 40, 20].map((t) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '8px', height: '1.5px', background: '#fff' }} />
                  <span style={{ fontSize: '0.55rem', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{t}%</span>
                </div>
              ))}
            </div>

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
                lineHeight: 1
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
        </div>
      </div>

      <div data-impeccable-variant="2" style={{ display: 'none' }}>
        <style data-impeccable-css="991dd7d7">{`
          @scope ([data-impeccable-variant="2"]) {
            :scope > .glass-card {
              backdrop-filter: blur(24px) !important;
              border: 1.5px solid rgba(255, 255, 255, 0.09) !important;
              background: rgba(19, 21, 32, 0.6) !important;
              box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.55) !important;
            }
            :scope .glass-beaker-wrapper {
              background: radial-gradient(circle at center, rgba(56, 189, 248, 0.03), transparent 75%), rgba(255, 255, 255, 0.01) !important;
              box-shadow: inset 0 0 35px rgba(56, 189, 248, 0.12), 0 12px 35px rgba(0, 0, 0, 0.5) !important;
              border-radius: 40px !important;
            }
            :scope .glass-beaker-wrapper span {
              filter: drop-shadow(0 0 8px var(--hydration-color));
            }
          }
        `}</style>
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

            {/* Shifting Wave Elements at liquid top surface */}
            {fillPercent > 0 && (
              <>
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
                lineHeight: 1
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
        </div>
      </div>

      <div data-impeccable-variant="3" style={{ display: 'none' }}>
        <style data-impeccable-css="991dd7d7">{`
          @scope ([data-impeccable-variant="3"]) {
            :scope > .glass-card {
              border: 1px solid rgba(255, 255, 255, 0.06) !important;
              background: rgba(19, 21, 32, 0.8) !important;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45) !important;
              min-height: 400px !important;
            }
            :scope .circular-gauge-container {
              position: relative;
              width: 170px;
              height: 170px;
              margin-top: 1.5rem;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            :scope .circular-percentage {
              font-size: 2.2rem;
              font-weight: 800;
              font-family: var(--font-display);
              color: #fff;
              line-height: 1;
              filter: drop-shadow(0 0 10px var(--hydration-color-glow));
            }
            :scope .circular-track {
              stroke: rgba(255, 255, 255, 0.03);
            }
            :scope .circular-fill {
              stroke: var(--hydration-color);
              stroke-linecap: round;
              filter: drop-shadow(0 0 6px var(--hydration-color-glow));
              transition: stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1);
            }
            :scope .quick-add-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 0.5rem !important;
              width: 100% !important;
              margin-top: 0.5rem !important;
              max-width: 280px !important;
            }
            :scope .quick-add-grid .btn-secondary {
              padding: 0.6rem !important;
              font-size: 0.8rem !important;
              border-radius: 12px !important;
              justify-content: center !important;
            }
          }
        `}</style>
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

          {/* Circular Progress Gauge */}
          <div className="circular-gauge-container">
            <svg width="150" height="150" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background circle track */}
              <circle
                cx="50"
                cy="50"
                r="42"
                strokeWidth="6"
                fill="transparent"
                className="circular-track"
              />
              {/* Animated fill circle */}
              <circle
                cx="50"
                cy="50"
                r="42"
                strokeWidth="7"
                fill="transparent"
                className="circular-fill"
                strokeDasharray={`${(fillPercent / 100) * 263.89} 263.89`}
              />
            </svg>

            {/* Glowing HUD Text inside circular progress gauge */}
            <div style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)'
            }}>
              <span className="circular-percentage">
                {Math.round(fillPercent)}%
              </span>
              <span style={{
                fontSize: '0.62rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: '0.15rem'
              }}>
                {consumedWater}ml / {targetAmount}ml
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
              marginTop: '0.25rem'
            }}>
              <Check size={14} />
              <span>DAILY HYDRATION HALO MET</span>
            </div>
          )}

          {/* Quick Increment Add Buttons Grid Deck */}
          {!showCustom ? (
            <div className="quick-add-grid">
              <button
                className="btn btn-secondary"
                onClick={() => handleAddAmount(250)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={12} />
                <span>250ml</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleAddAmount(500)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={12} />
                <span>500ml</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleAddAmount(750)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={12} />
                <span>750ml</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowCustom(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  color: 'var(--text-secondary)'
                }}
              >
                <span>+ Custom</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} style={{
              display: 'flex',
              gap: '0.4rem',
              alignItems: 'center',
              width: '100%',
              maxWidth: '240px',
              marginTop: '0.5rem',
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
      </div>
      {/* impeccable-variants-end 991dd7d7 */}
    </div>
  );
};
export default HydrationTracker;