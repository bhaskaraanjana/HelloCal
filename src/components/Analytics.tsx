import React from 'react';
import type { MealLog, WorkoutLog, UserGoals } from '../types/nutrition';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import { BarChart3, PieChart, Flame, Trophy, Activity, Sparkles, TrendingUp, CheckCircle } from 'lucide-react';

ChartJS.register(...registerables);

interface AnalyticsProps {
  logs: MealLog[];
  workouts?: WorkoutLog[];
  goals: UserGoals;
}

export const Analytics: React.FC<AnalyticsProps> = ({ logs, workouts = [], goals }) => {
  // Selectable historical timeline interval (7, 14, or 30 days)
  const [period, setPeriod] = React.useState<number>(7);

  // Calculate past history dates based on selected period
  const getPastDays = (numDays: number) => {
    const dates = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      dates.push(d);
    }
    return dates;
  };

  const pastDays = getPastDays(period);
  const weekdayLabels = pastDays.map(date => {
    if (period > 7) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString([], { weekday: 'short' });
  });

  // Calculate daily totals for calories
  const dailyCalories = pastDays.map(date => {
    const start = date.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const dayLogs = logs.filter(log => log.timestamp >= start && log.timestamp < end);
    let totalCals = 0;
    dayLogs.forEach(log => {
      log.items.forEach(item => {
        totalCals += Number(item.calories) || 0;
      });
    });
    return totalCals;
  });

  // Calculate daily totals for workouts burn
  const dailyBurned = pastDays.map(date => {
    const start = date.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const dayWorkouts = workouts.filter(w => w.timestamp >= start && w.timestamp < end);
    let totalBurn = 0;
    dayWorkouts.forEach(w => {
      totalBurn += Number(w.caloriesBurned) || 0;
    });
    return totalBurn;
  });

  // Calculate daily macronutrients for stacked bar chart
  const dailyProtein = pastDays.map(date => {
    const start = date.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const dayLogs = logs.filter(log => log.timestamp >= start && log.timestamp < end);
    let total = 0;
    dayLogs.forEach(log => {
      log.items.forEach(item => {
        total += Number(item.protein) || 0;
      });
    });
    return Math.round(total);
  });

  const dailyCarbs = pastDays.map(date => {
    const start = date.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const dayLogs = logs.filter(log => log.timestamp >= start && log.timestamp < end);
    let total = 0;
    dayLogs.forEach(log => {
      log.items.forEach(item => {
        total += Number(item.carbs) || 0;
      });
    });
    return Math.round(total);
  });

  const dailyFat = pastDays.map(date => {
    const start = date.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const dayLogs = logs.filter(log => log.timestamp >= start && log.timestamp < end);
    let total = 0;
    dayLogs.forEach(log => {
      log.items.forEach(item => {
        total += Number(item.fat) || 0;
      });
    });
    return Math.round(total);
  });

  // Averages summary logic
  const weeklyCalorieAvg = Math.round(dailyCalories.reduce((sum, val) => sum + val, 0) / period);
  const weeklyBurnAvg = Math.round(dailyBurned.reduce((sum, val) => sum + val, 0) / period);

  // Consistency Halo Index
  let consistentDays = 0;
  pastDays.forEach((_, idx) => {
    const consumed = dailyCalories[idx];
    const activeBurn = dailyBurned[idx];
    const dailyGoal = (goals.calories || 2000) + activeBurn;

    // staying within +/- 150 kcal is consistent
    if (consumed > 0 && Math.abs(consumed - dailyGoal) <= 150) {
      consistentDays++;
    }
  });
  const consistencyIndex = Math.round((consistentDays / period) * 100);

  // Selected period calculations for macro ratios and micronutrient details.
  // Bound BOTH ends with the same half-open window the daily bars use, else a
  // future-dated/clock-skewed log inflates the period totals while the divisor
  // (`period`) stays fixed, skewing per-day averages and the macro pie.
  const startOfPeriod = pastDays[0].getTime();
  const endOfPeriod = pastDays[pastDays.length - 1].getTime() + 24 * 60 * 60 * 1000;
  const periodLogs = logs.filter(log => log.timestamp >= startOfPeriod && log.timestamp < endOfPeriod);

  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalSugar = 0;
  let totalFiber = 0;
  let totalSodium = 0;
  let totalIron = 0;

  periodLogs.forEach(log => {
    log.items.forEach(item => {
      totalProtein += Number(item.protein) || 0;
      totalCarbs += Number(item.carbs) || 0;
      totalFat += Number(item.fat) || 0;
      totalSugar += Number(item.addedSugar) || Number(item.sugar) || 0;
      totalFiber += Number(item.fiber) || 0;
      totalSodium += Number(item.sodium) || 0;
      totalIron += Number(item.iron) || 0;
    });
  });

  // Calculate averages per day for micronutrients
  const avgSugar = totalSugar / period;
  const avgFiber = totalFiber / period;
  const avgSodium = totalSodium / period;
  const avgIron = totalIron / period;

  const proteinCals = totalProtein * 4;
  const carbsCals = totalCarbs * 4;
  const fatCals = totalFat * 9;
  const totalMacroCals = proteinCals + carbsCals + fatCals;

  // Chart 1: Calorie History Bar Chart
  const calorieChartData = {
    labels: weekdayLabels,
    datasets: [
      {
        label: 'Consumed Kcal',
        data: dailyCalories,
        backgroundColor: 'rgba(139, 92, 246, 0.45)',
        borderColor: 'var(--accent-purple)',
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: 'var(--accent-purple)',
        barThickness: 20
      },
      {
        label: 'Daily Goal Kcal',
        data: pastDays.map((_, idx) => (goals.calories || 2000) + dailyBurned[idx]),
        type: 'line' as const,
        borderColor: '#ffffff',
        borderWidth: 2.5,
        borderDash: [6, 4],
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#ffffff',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: false
      }
    ] as any[]
  };

  const calorieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#aab6c7',
          font: { family: 'Outfit', size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(19, 21, 32, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#aab6c7',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#aab6c7', font: { family: 'Outfit', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#aab6c7', font: { family: 'Outfit', size: 11 } }
      }
    }
  };

  // Chart 2: Stacked Macro Bar Chart
  const stackedMacroChartData = {
    labels: weekdayLabels,
    datasets: [
      {
        label: '🥩 Protein (g)',
        data: dailyProtein,
        backgroundColor: 'rgba(20, 184, 166, 0.55)',
        borderColor: 'var(--accent-teal)',
        borderWidth: 2,
        borderRadius: 4
      },
      {
        label: '🌾 Carbohydrates (g)',
        data: dailyCarbs,
        backgroundColor: 'rgba(6, 182, 212, 0.55)',
        borderColor: 'var(--accent-blue)',
        borderWidth: 2,
        borderRadius: 4
      },
      {
        label: '🥑 Fats (g)',
        data: dailyFat,
        backgroundColor: 'rgba(245, 158, 11, 0.55)',
        borderColor: 'var(--accent-amber)',
        borderWidth: 2,
        borderRadius: 4
      }
    ]
  };

  const stackedMacroChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#aab6c7',
          font: { family: 'Outfit', size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(19, 21, 32, 0.95)',
        padding: 12,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            return ` ${context.dataset.label.split(' ')[1]}: ${context.raw}g`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#aab6c7', font: { family: 'Outfit', size: 11 } }
      },
      y: {
        stacked: true,
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#aab6c7', font: { family: 'Outfit', size: 11 } }
      }
    }
  };

  // Chart 3: Today's Macro Ratio Doughnut
  const hasData = totalMacroCals > 0;
  const doughnutChartData = {
    labels: ['Protein', 'Carbohydrates', 'Fats'],
    datasets: [
      {
        data: hasData ? [proteinCals, carbsCals, fatCals] : [1, 1, 1],
        backgroundColor: hasData 
          ? ['var(--accent-teal)', 'var(--accent-blue)', 'var(--accent-amber)']
          : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.03)'],
        borderColor: 'var(--bg-secondary)',
        borderWidth: 3,
        hoverOffset: 4
      }
    ]
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#aab6c7',
          font: { family: 'Outfit', size: 12 },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        enabled: hasData,
        backgroundColor: 'rgba(19, 21, 32, 0.95)',
        padding: 12,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            const val = context.raw;
            const pct = totalMacroCals > 0 ? Math.round((val / totalMacroCals) * 100) : 0;
            return ` ${context.label}: ${pct}% of cals`;
          }
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      
      {/* Premium Period Selector Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.015)',
        border: '1px solid var(--border-glass)',
        padding: '0.85rem 1.5rem',
        borderRadius: '16px',
        width: '100%',
        boxSizing: 'border-box',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Analytical Pacing Dashboard
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Historical trends, target consistency scores, and biometric logs overview
          </span>
        </div>

        {/* Glassmorphic period selection capsules */}
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          background: 'rgba(255,255,255,0.02)',
          padding: '0.25rem',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)'
        }}>
          {([
            { label: '7 Days', val: 7 },
            { label: '14 Days', val: 14 },
            { label: '30 Days', val: 30 }
          ]).map(opt => (
            <button
              key={opt.val}
              onClick={() => setPeriod(opt.val)}
              style={{
                background: period === opt.val ? 'var(--accent-teal)' : 'transparent',
                color: period === opt.val ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 650,
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Dynamic Period Averages Summary Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem'
      }}>
        
        {/* Calorie Average Card */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-purple)'
          }}>
            <TrendingUp size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
              Calorie Intake Avg ({period} Days)
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {weeklyCalorieAvg} <span style={{ fontSize: '0.8rem', fontWeight: 550, color: 'var(--text-muted)' }}>kcal/day</span>
            </span>
          </div>
        </div>

        {/* Workout Burn Card */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-teal)'
          }}>
            <Flame size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
              Workout Burn Avg ({period} Days)
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-teal)', fontFamily: 'var(--font-display)' }}>
              {weeklyBurnAvg} <span style={{ fontSize: '0.8rem', fontWeight: 550, color: 'var(--text-muted)' }}>kcal/day</span>
            </span>
          </div>
        </div>

        {/* Consistency Index Card */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-teal)'
          }}>
            <Trophy size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
              Halo Consistency Index
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {consistencyIndex}% <span style={{ fontSize: '0.75rem', color: 'var(--accent-teal)' }}>({consistentDays}/{period} days)</span>
            </span>
          </div>
        </div>

      </div>

      {/* 2. Primary Analytics Charts Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem'
      }}>
        
        {/* Calorie history card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '360px', padding: '1.5rem' }}>
          <h3 style={{
            fontSize: '1.1rem',
            marginBottom: '1rem',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <BarChart3 size={18} color="var(--accent-purple)" />
            Calorie Consumed vs Daily Target Goals
          </h3>
          <div style={{ flex: 1, position: 'relative', width: '100%' }}>
            <Bar data={calorieChartData} options={calorieChartOptions} />
          </div>
        </div>

        {/* Stacked Macronutrient history card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '360px', padding: '1.5rem' }}>
          <h3 style={{
            fontSize: '1.1rem',
            marginBottom: '1rem',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Activity size={18} color="var(--accent-teal)" />
            {period}-Day Macronutrient Stacked Levels (g)
          </h3>
          <div style={{ flex: 1, position: 'relative', width: '100%' }}>
            <Bar data={stackedMacroChartData} options={stackedMacroChartOptions} />
          </div>
        </div>

      </div>

      {/* 3. Selected Period averages row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem'
      }}>
        
        {/* Macro doughnut */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '350px', padding: '1.5rem' }}>
          <h3 style={{
            fontSize: '1.1rem',
            marginBottom: '1rem',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <PieChart size={18} color="var(--accent-teal)" />
            Caloric Macro Ratios ({period} Days)
          </h3>
          <div style={{ flex: 1, position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {hasData ? (
              <div style={{ width: '100%', height: '100%' }}>
                <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
                textAlign: 'center',
                gap: '0.5rem',
                height: '100%'
              }}>
                <div style={{ width: '130px', height: '130px', opacity: 0.15 }}>
                  <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
                </div>
                <span>No macro data logged in this period.</span>
                <span style={{ fontSize: '0.8rem' }}>Ratios will populate as soon as you log meals.</span>
              </div>
            )}
          </div>
        </div>

        {/* Micronutrients and Iron period averages deck */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '350px', padding: '1.5rem', justifyContent: 'space-between' }}>
          <h3 style={{
            fontSize: '1.1rem',
            marginBottom: '1rem',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            paddingBottom: '0.5rem'
          }}>
            <Sparkles size={18} color="var(--accent-purple)" />
            Micronutrient Daily Averages ({period} Days)
          </h3>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem', justifyContent: 'center' }}>
            
            {/* Added Sugar row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>🍭 Added Sugar (Avg)</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {Math.round(avgSugar * 10) / 10}g / {goals.addedSugar || 30}g limit
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min((avgSugar / (goals.addedSugar || 30)) * 100, 100)}%`,
                  height: '100%',
                  background: avgSugar > (goals.addedSugar || 30) ? 'var(--accent-rose)' : 'var(--accent-purple)',
                  boxShadow: avgSugar > (goals.addedSugar || 30) ? '0 0 8px var(--accent-rose-glow)' : '0 0 8px var(--accent-purple-glow)'
                }} />
              </div>
            </div>

            {/* Fiber row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>🌿 Dietary Fiber (Avg)</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {Math.round(avgFiber * 10) / 10}g / {goals.fiber || 30}g goal
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min((avgFiber / (goals.fiber || 30)) * 100, 100)}%`,
                  height: '100%',
                  background: 'var(--accent-teal)',
                  boxShadow: '0 0 8px var(--accent-teal-glow)'
                }} />
              </div>
            </div>

            {/* Sodium row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>🧂 Sodium Intake (Avg)</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {Math.round(avgSodium)}mg / {goals.sodium || 2300}mg limit
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min((avgSodium / (goals.sodium || 2300)) * 100, 100)}%`,
                  height: '100%',
                  background: avgSodium > (goals.sodium || 2300) ? 'var(--accent-rose)' : 'var(--accent-amber)',
                  boxShadow: avgSodium > (goals.sodium || 2300) ? '0 0 8px var(--accent-rose-glow)' : '0 0 8px var(--accent-amber-glow)'
                }} />
              </div>
            </div>

            {/* Iron row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>🩸 Iron Level (Avg)</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {Math.round(avgIron * 10) / 10}mg / {goals.iron || 18}mg goal
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min((avgIron / (goals.iron || 18)) * 100, 100)}%`,
                  height: '100%',
                  background: 'var(--accent-rose)',
                  boxShadow: '0 0 8px var(--accent-rose-glow)'
                }} />
              </div>
            </div>

          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
            <CheckCircle size={10} color="var(--accent-teal)" />
            <span>Averages are updated automatically based on selected period filters!</span>
          </div>
        </div>

      </div>

    </div>
  );
};
export default Analytics;
