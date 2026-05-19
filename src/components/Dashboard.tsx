import React from 'react';
import type { MealLog, UserGoals } from '../types/nutrition';
import RingProgress from './ui/RingProgress';
import ProgressBar from './ui/ProgressBar';
import { Flame, Trophy, Calendar, Utensils } from 'lucide-react';

interface DashboardProps {
  logs: MealLog[];
  goals: UserGoals;
}

export const Dashboard: React.FC<DashboardProps> = ({ logs, goals }) => {
  // Get start of today (midnight)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfToday = today.getTime();

  // Filter logs for today
  const todayLogs = logs.filter(log => log.timestamp >= startOfToday);

  // Sum today's macros and calories
  let consumedCalories = 0;
  let consumedProtein = 0;
  let consumedCarbs = 0;
  let consumedFat = 0;

  todayLogs.forEach(log => {
    log.items.forEach(item => {
      consumedCalories += Number(item.calories) || 0;
      consumedProtein += Number(item.protein) || 0;
      consumedCarbs += Number(item.carbs) || 0;
      consumedFat += Number(item.fat) || 0;
    });
  });

  const remainingCalories = Math.max(goals.calories - consumedCalories, 0);
  const isOverBudget = consumedCalories > goals.calories;
  const overBudgetCals = consumedCalories - goals.calories;

  // Meal type counts
  const breakfastCount = todayLogs.filter(l => l.mealType === 'breakfast').length;
  const lunchCount = todayLogs.filter(l => l.mealType === 'lunch').length;
  const dinnerCount = todayLogs.filter(l => l.mealType === 'dinner').length;
  const snackCount = todayLogs.filter(l => l.mealType === 'snack').length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
      
      {/* Upper Grid - Calorie Ring + Macro bars */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        alignItems: 'stretch'
      }}>
        
        {/* Calorie Progress Ring Card */}
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
            <span>DAILY HALO</span>
          </div>

          <RingProgress 
            value={consumedCalories} 
            max={goals.calories} 
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
            color: 'var(--text-secondary)'
          }}>
            Logged <strong style={{ color: 'var(--text-primary)' }}>{consumedCalories} kcal</strong> out of your <strong style={{ color: 'var(--text-primary)' }}>{goals.calories} kcal</strong> goal.
          </div>
        </div>

        {/* Macronutrient Bars Card */}
        <div className="glass-card" style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '2rem 1.75rem'
        }}>
          <h3 style={{
            fontSize: '1.1rem',
            marginBottom: '1.5rem',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Trophy size={18} color="var(--accent-amber)" />
            Macronutrient Target Levels
          </h3>

          <ProgressBar 
            label="🍗 Protein" 
            value={consumedProtein} 
            max={goals.protein} 
            color="var(--accent-teal)" 
            glowColor="var(--accent-teal-glow)" 
          />
          
          <ProgressBar 
            label="🥑 Fats" 
            value={consumedFat} 
            max={goals.fat} 
            color="var(--accent-amber)" 
            glowColor="var(--accent-amber-glow)" 
          />
          
          <ProgressBar 
            label="🌾 Carbohydrates" 
            value={consumedCarbs} 
            max={goals.carbs} 
            color="var(--accent-blue)" 
            glowColor="var(--accent-blue-glow)" 
          />
        </div>

      </div>

      {/* Lower Grid - Stats cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem'
      }}>
        {/* Total Meals Card */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem' }}>
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

        {/* Target Progress Card */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem' }}>
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
              {Math.min(Math.round((consumedCalories / goals.calories) * 100), 100)}%
            </span>
          </div>
        </div>

        {/* Meal breakdown summary */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem' }}>
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
      </div>

    </div>
  );
};
export default Dashboard;
