import React, { useMemo } from 'react';
import type { MealLog, WorkoutLog, UserGoals, AppSettings } from '../types/nutrition';
import RingProgress from './ui/RingProgress';
import ProgressBar from './ui/ProgressBar';
import { computeDailyTotals } from '../services/dailyTotals';
import { Flame, Trophy, Calendar, Utensils, Sparkles } from 'lucide-react';

interface DashboardProps {
  logs: MealLog[];
  workouts?: WorkoutLog[];
  goals: UserGoals;
  appSettings: AppSettings;
  onTriggerCustomize: (scope: 'general' | 'macronutrients' | 'micronutrients' | 'widgets') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  logs,
  workouts = [],
  goals,
  appSettings,
  onTriggerCustomize
}) => {
  // All of today's totals come from the shared computeDailyTotals source of truth,
  // memoized so they only recompute when logs/workouts actually change (not on
  // every parent re-render from toasts, modals, theme switches, etc.).
  const {
    todayLogs,
    todayWorkouts,
    consumedCalories,
    consumedProtein,
    consumedCarbs,
    consumedFat,
    consumedAddedSugar,
    consumedFiber,
    consumedSodium,
    totalBurnedCalories,
    totalWorkoutMinutes,
    breakfastCount,
    lunchCount,
    dinnerCount,
    snackCount,
  } = useMemo(() => computeDailyTotals(logs, workouts), [logs, workouts]);

  // Dynamic Calorie halo expansion calculations
  const baseCalorieGoal = Number(goals.calories) || 2000;
  const expandedCalorieGoal = baseCalorieGoal + totalBurnedCalories;

  const remainingCalories = Math.max(expandedCalorieGoal - consumedCalories, 0);
  const isOverBudget = consumedCalories > expandedCalorieGoal;
  const overBudgetCals = consumedCalories - expandedCalorieGoal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* First-log nudge: when nothing is logged today, point to the input above. */}
      {todayLogs.length === 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.7rem 1rem',
          borderRadius: '14px',
          background: 'rgba(139, 92, 246, 0.06)',
          border: '1px solid var(--border-glass)',
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
          fontFamily: 'var(--font-display)'
        }}>
          <Sparkles size={16} color="var(--accent-purple)" style={{ flexShrink: 0 }} />
          <span>Quick start: tap the mic, type a food, scan a barcode, or use Quick Add above to log your first meal.</span>
        </div>
      )}

      {/* Upper Grid - Calorie Ring + Macro bars */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        alignItems: 'stretch'
      }}>
        
        {/* Calorie Progress Ring Card */}
        {appSettings.visibleWidgets.calorieHalo && (
          <div className="glass-card" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            position: 'relative'
          }}>
            {/* Flame icon decoration */}
            <div style={{
              position: 'absolute',
              top: '1rem',
              left: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--accent-purple)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-display)',
              fontWeight: 600
            }}>
              <Flame size={16} />
              <span>DAILY DYNAMIC HALO</span>
            </div>

            {/* Clickable Card Customize trigger sparkles */}
            <button 
              onClick={() => onTriggerCustomize('general')}
              className="glow-sparkles-btn"
              title="Voice Customize Card"
              style={{
                position: 'absolute',
                top: '0.85rem',
                right: '0.85rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                transition: 'var(--transition-smooth)',
                padding: '0.25rem'
              }}
            >
              <Sparkles size={14} />
            </button>

            <RingProgress 
              value={consumedCalories} 
              max={expandedCalorieGoal} 
              size={220}
              strokeWidth={16}
              color="var(--accent-purple)"
              glowColor="var(--accent-purple-glow)"
            >
              <span style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                color: isOverBudget ? 'var(--accent-rose)' : 'var(--text-primary)',
                lineHeight: '1'
              }}>
                {isOverBudget ? `+${overBudgetCals}` : remainingCalories}
              </span>
              <span style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-display)',
                marginTop: '0.2rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {isOverBudget ? 'kcal over' : 'kcal remaining'}
              </span>
            </RingProgress>

            <div style={{
              marginTop: '1.5rem',
              textAlign: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.4'
            }}>
              Logged <strong style={{ color: 'var(--text-primary)' }}>{consumedCalories} kcal</strong> out of your <strong style={{ color: 'var(--text-primary)' }}>{expandedCalorieGoal} kcal</strong> expanded halo.
              {totalBurnedCalories > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-teal)', marginTop: '0.25rem' }}>
                  🏃‍♂️ Base Target {baseCalorieGoal} kcal + Active Burn {totalBurnedCalories} kcal
                </div>
              )}
            </div>
          </div>
        )}

        {/* Macronutrient Bars Card */}
        {appSettings.visibleWidgets.macros && (
          <div className="glass-card" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '2rem 1.75rem',
            position: 'relative'
          }}>
            <h3 
              onClick={() => onTriggerCustomize('macronutrients')}
              style={{
                fontSize: '1.1rem',
                marginBottom: '1.5rem',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
              className="card-clickable-header"
            >
              <Trophy size={18} color="var(--accent-amber)" />
              Macronutrient Target Levels
              <Sparkles size={12} color="var(--accent-purple)" style={{ opacity: 0.6 }} />
            </h3>

            {/* Corner Sparkle action */}
            <button 
              onClick={() => onTriggerCustomize('macronutrients')}
              className="glow-sparkles-btn"
              title="Voice Customize Macros"
              style={{
                position: 'absolute',
                top: '0.85rem',
                right: '0.85rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                transition: 'var(--transition-smooth)',
                padding: '0.25rem'
              }}
            >
              <Sparkles size={14} />
            </button>

            {appSettings.visibleMacros.protein && (
              <ProgressBar 
                label="🍗 Protein" 
                value={consumedProtein} 
                max={goals.protein} 
                color="var(--accent-teal)" 
                glowColor="var(--accent-teal-glow)" 
              />
            )}
            
            {appSettings.visibleMacros.fat && (
              <ProgressBar 
                label="🥑 Fats" 
                value={consumedFat} 
                max={goals.fat} 
                color="var(--accent-amber)" 
                glowColor="var(--accent-amber-glow)" 
              />
            )}
            
            {appSettings.visibleMacros.carbs && (
              <ProgressBar 
                label="🌾 Carbohydrates" 
                value={consumedCarbs} 
                max={goals.carbs} 
                color="var(--accent-blue)" 
                glowColor="var(--accent-blue-glow)" 
              />
            )}
          </div>
        )}

      </div>

      {/* Secondary HUD Grid - Micronutrient Target Limits Card + Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        alignItems: 'stretch'
      }}>
        
        {/* Micronutrients Progress Card */}
        {appSettings.visibleWidgets.micros && (
          <div className="glass-card" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '2rem 1.75rem',
            position: 'relative'
          }}>
            <h3 
              onClick={() => onTriggerCustomize('micronutrients')}
              style={{
                fontSize: '1.1rem',
                marginBottom: '1.5rem',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
              className="card-clickable-header"
            >
              <Sparkles size={18} color="var(--accent-purple)" />
              Micronutrient Dashboard Target
            </h3>

            {/* Corner Sparkle action */}
            <button 
              onClick={() => onTriggerCustomize('micronutrients')}
              className="glow-sparkles-btn"
              title="Voice Customize Micros"
              style={{
                position: 'absolute',
                top: '0.85rem',
                right: '0.85rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                transition: 'var(--transition-smooth)',
                padding: '0.25rem'
              }}
            >
              <Sparkles size={14} />
            </button>

            {appSettings.visibleMicros.addedSugar && (
              <ProgressBar 
                label="🍭 Added Sugar (Limit)" 
                value={consumedAddedSugar} 
                max={goals.addedSugar || 30} 
                color={consumedAddedSugar > (goals.addedSugar || 30) ? 'var(--accent-rose)' : 'var(--accent-purple)'} 
                glowColor={consumedAddedSugar > (goals.addedSugar || 30) ? 'var(--accent-rose-glow)' : 'var(--accent-purple-glow)'} 
              />
            )}
            
            {appSettings.visibleMicros.fiber && (
              <ProgressBar 
                label="🌿 Dietary Fiber (Target)" 
                value={consumedFiber} 
                max={goals.fiber || 30} 
                color="var(--accent-teal)" 
                glowColor="var(--accent-teal-glow)" 
              />
            )}
            
            {appSettings.visibleMicros.sodium && (
              <ProgressBar 
                label="🧂 Sodium (Limit)" 
                value={consumedSodium} 
                max={goals.sodium || 2300} 
                color={consumedSodium > (goals.sodium || 2300) ? 'var(--accent-rose)' : 'var(--accent-amber)'} 
                glowColor={consumedSodium > (goals.sodium || 2300) ? 'var(--accent-rose-glow)' : 'var(--accent-amber-glow)'} 
                unit="mg"
              />
            )}
          </div>
        )}

        {/* Lower Stats Grid nested inside */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between', position: 'relative' }}>
          
          {/* Card customization trigger inside stats region */}
          <button 
            onClick={() => onTriggerCustomize('widgets')}
            className="glow-sparkles-btn"
            title="Voice Toggle Stats Widgets"
            style={{
              position: 'absolute',
              top: '-1rem',
              right: '0rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'var(--transition-smooth)',
              padding: '0.25rem',
              zIndex: 10
            }}
          >
            <Sparkles size={14} />
          </button>

          {/* Total Meals Card */}
          {appSettings.visibleWidgets.mealSlots && (
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem', flex: 1 }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue)'
              }}>
                <Utensils size={20} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>Logged Meals</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{todayLogs.length} today</span>
              </div>
            </div>
          )}

          {/* Target Progress Card */}
          {appSettings.visibleWidgets.goalCompletion && (
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem', flex: 1 }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-teal)'
              }}>
                <Trophy size={20} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>Goal Completion</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {Math.min(Math.round((consumedCalories / expandedCalorieGoal) * 100), 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Meal breakdown summary */}
          {appSettings.visibleWidgets.mealSlots && (
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem', flex: 1 }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-amber)'
              }}>
                <Calendar size={20} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', marginBottom: '0.2rem' }}>Meal Slots today</span>
                <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                  <span style={{ opacity: breakfastCount > 0 ? 1 : 0.4 }}>🍳 B:{breakfastCount}</span>
                  <span style={{ opacity: lunchCount > 0 ? 1 : 0.4 }}>🍱 L:{lunchCount}</span>
                  <span style={{ opacity: dinnerCount > 0 ? 1 : 0.4 }}>🥗 D:{dinnerCount}</span>
                  <span style={{ opacity: snackCount > 0 ? 1 : 0.4 }}>🍪 S:{snackCount}</span>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Today's Logged Workouts Widget */}
      {appSettings.visibleWidgets.workouts && todayWorkouts.length > 0 && (
        <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(6, 182, 212, 0.15)', position: 'relative' }}>
          
          {/* Corner Sparkle action */}
          <button 
            onClick={() => onTriggerCustomize('widgets')}
            className="glow-sparkles-btn"
            title="Voice Customize Workouts Widget"
            style={{
              position: 'absolute',
              top: '0.85rem',
              right: '0.85rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'var(--transition-smooth)',
              padding: '0.25rem'
            }}
          >
            <Sparkles size={14} />
          </button>

          <h3 
            onClick={() => onTriggerCustomize('widgets')}
            style={{
              fontSize: '1.1rem',
              marginBottom: '1.25rem',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
            className="card-clickable-header"
          >
            <Flame size={18} color="var(--accent-teal)" />
            Active Workouts Logged Today ({todayWorkouts.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {todayWorkouts.map((w) => (
              <div 
                key={w.id} 
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{w.activity}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>Duration: {w.duration} mins • {w.notes || 'No details'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-teal)' }}>-{w.caloriesBurned}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>kcal</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right', borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem' }}>
            Total Active Burn: <strong style={{ color: 'var(--accent-teal)', fontSize: '1rem' }}>-{totalBurnedCalories} kcal</strong> across <strong style={{ color: 'var(--text-primary)' }}>{totalWorkoutMinutes} mins</strong>
          </div>
        </div>
      )}

      {/* Futuristic Hover Styling Injections for dynamic clickable HUD elements */}
      <style dangerouslySetInnerHTML={{__html: `
        .card-clickable-header {
          transition: var(--transition-smooth);
        }
        .card-clickable-header:hover {
          color: var(--accent-purple) !important;
          text-shadow: 0 0 8px var(--accent-purple-glow);
          transform: translateX(2px);
        }
        .glow-sparkles-btn {
          opacity: 0.4;
        }
        .glow-sparkles-btn:hover {
          opacity: 1 !important;
          color: var(--accent-purple) !important;
          transform: rotate(15deg) scale(1.15);
          filter: drop-shadow(0 0 4px var(--accent-purple-glow));
        }
        .glass-card:hover .glow-sparkles-btn {
          opacity: 0.8;
        }
      `}} />

    </div>
  );
};
export default Dashboard;
