import React from 'react';
import type { MealLog, UserGoals } from '../types/nutrition';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
} from 'chart.js';
import { BarChart3, PieChart } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

interface AnalyticsProps {
  logs: MealLog[];
  goals: UserGoals;
}

export const Analytics: React.FC<AnalyticsProps> = ({ logs }) => {
  // 1. Calculate 7-day intake history
  const getPastSevenDays = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      dates.push(d);
    }
    return dates;
  };

  const pastSevenDays = getPastSevenDays();
  
  // Calculate daily totals for past 7 days
  const dailyCalories = pastSevenDays.map(date => {
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

  const weekdayLabels = pastSevenDays.map(date => {
    return date.toLocaleDateString([], { weekday: 'short' });
  });

  // Calculate today's totals for macros
  const today = new Date();
  today.setHours(0,0,0,0);
  const startOfToday = today.getTime();
  const todayLogs = logs.filter(log => log.timestamp >= startOfToday);

  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  todayLogs.forEach(log => {
    log.items.forEach(item => {
      totalProtein += Number(item.protein) || 0;
      totalCarbs += Number(item.carbs) || 0;
      totalFat += Number(item.fat) || 0;
    });
  });

  // Convert macros to calories for ratio: protein = 4 cals/g, carbs = 4 cals/g, fat = 9 cals/g
  const proteinCals = totalProtein * 4;
  const carbsCals = totalCarbs * 4;
  const fatCals = totalFat * 9;
  const totalMacroCals = proteinCals + carbsCals + fatCals;

  // Chart 1: Calorie History Bar Chart
  const barChartData = {
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
        barThickness: 24
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(19, 21, 32, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        titleFont: {
          family: 'Outfit'
        },
        bodyFont: {
          family: 'Inter'
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: 'Outfit',
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.04)'
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: 'Outfit',
            size: 11
          }
        }
      }
    }
  };

  // Chart 2: Today's Macro Ratio Doughnut
  const hasData = totalMacroCals > 0;
  const doughnutChartData = {
    labels: ['Protein', 'Carbohydrates', 'Fats'],
    datasets: [
      {
        data: hasData ? [proteinCals, carbsCals, fatCals] : [1, 1, 1], // uniform mock if empty
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
          color: '#94a3b8',
          font: {
            family: 'Outfit',
            size: 12
          },
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
            const pct = Math.round((val / totalMacroCals) * 100);
            return ` ${context.label}: ${pct}% of cals`;
          }
        }
      }
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: '1.5rem',
      alignItems: 'stretch'
    }}>
      
      {/* 7-day Bar Chart */}
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
          Weekly Calorie Budget Trends
        </h3>
        <div style={{ flex: 1, position: 'relative', width: '100%' }}>
          <Bar data={barChartData} options={barChartOptions} />
        </div>
      </div>

      {/* Macro distribution chart */}
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
          <PieChart size={18} color="var(--accent-teal)" />
          Caloric Macro Distribution
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
              <span>No macro data logged today.</span>
              <span style={{ fontSize: '0.8rem' }}>Ratios will populate as soon as you log a meal.</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
export default Analytics;
