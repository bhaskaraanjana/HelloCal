import React, { useState } from 'react';
import type { MealLog, WorkoutLog, UserGoals } from '../types/nutrition';
import {
  Trash2,
  CalendarRange,
  Clock,
  Coffee,
  Sunset,
  Moon,
  Cookie,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Activity,
  Pencil,
  CopyPlus,
  Mic,
  Camera,
  Keyboard
} from 'lucide-react';
import { EmptyState } from './ui/EmptyState';

interface FoodTimelineProps {
  logs: MealLog[];
  workouts?: WorkoutLog[];
  onDeleteLog: (id: string) => void;
  onDeleteWorkout?: (id: string) => void;
  onEditLog?: (log: MealLog) => void;
  onCopyDay?: (dayStart: number) => void;
  onCopyMeal?: (log: MealLog) => void;
  goals?: UserGoals;
}

export const FoodTimeline: React.FC<FoodTimelineProps> = ({ logs, workouts = [], onDeleteLog, onDeleteWorkout, onEditLog, onCopyDay, onCopyMeal, goals }) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'feed'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [expandedFoodKey, setExpandedFoodKey] = useState<string | null>(null);

  const toggleFoodExpand = (key: string) => {
    setExpandedFoodKey(expandedFoodKey === key ? null : key);
  };

  // Date Comparison Helper
  const isSameDay = (t1: number, t2: number) => {
    const d1 = new Date(t1);
    const d2 = new Date(t2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Check if a specific date has any logs
  const dayHasLogs = (date: Date) => {
    return logs.some(log => isSameDay(log.timestamp, date.getTime())) ||
           workouts.some(w => isSameDay(w.timestamp, date.getTime()));
  };

  // Helper to format timestamps
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get days in a month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get index of first day of a month (0-6)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  // Centered weekly strip generator (centers around selectedDate)
  const getHorizontalDays = (center: Date) => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(center);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  };

  const horizontalDays = getHorizontalDays(selectedDate);

  // Month navigation in grid calendar
  const handlePrevMonth = () => {
    setCurrentMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  // Construct combined timeline list
  interface TimelineItem {
    type: 'food' | 'workout';
    timestamp: number;
    item: any;
  }

  const combinedItems: TimelineItem[] = [
    ...logs.map(log => ({ type: 'food' as const, timestamp: log.timestamp, item: log })),
    ...workouts.map(w => ({ type: 'workout' as const, timestamp: w.timestamp, item: w }))
  ];

  // Filter based on selection mode
  const filteredTimeline = combinedItems
    .filter(x => {
      if (viewMode === 'feed') return true;
      return isSameDay(x.timestamp, selectedDate.getTime());
    })
    .sort((a, b) => b.timestamp - a.timestamp); // newest first

  // Compute selected day totals
  let dailyCals = 0;
  let dailyProtein = 0;
  let dailyCarbs = 0;
  let dailyFat = 0;
  let dailyBurned = 0;

  if (viewMode === 'calendar') {
    filteredTimeline.forEach(x => {
      if (x.type === 'food') {
        const log = x.item as MealLog;
        log.items.forEach(item => {
          dailyCals += Number(item.calories) || 0;
          dailyProtein += Number(item.protein) || 0;
          dailyCarbs += Number(item.carbs) || 0;
          dailyFat += Number(item.fat) || 0;
        });
      } else if (x.type === 'workout') {
        const w = x.item as WorkoutLog;
        dailyBurned += Number(w.caloriesBurned) || 0;
      }
    });
  }

  // Get meal icon based on type
  const getMealIcon = (type: string) => {
    switch (type) {
      case 'breakfast':
        return <Coffee size={16} color="var(--accent-amber)" />;
      case 'lunch':
        return <Sunset size={16} color="var(--accent-blue)" />;
      case 'dinner':
        return <Moon size={16} color="var(--accent-purple)" />;
      default:
        return <Cookie size={16} color="var(--text-secondary)" />;
    }
  };

  const getMealHeaderLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Month calendar grid renderer
  const renderMonthDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);
    const cells = [];
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const headers = weekdays.map(day => (
      <div key={`header-${day}`} style={{
        textAlign: 'center',
        fontSize: '0.7rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        padding: '0.2rem 0',
        fontFamily: 'var(--font-display)'
      }}>
        {day}
      </div>
    ));

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const isSelected = isSameDay(date.getTime(), selectedDate.getTime());
      const hasLogs = dayHasLogs(date);
      const isToday = isSameDay(date.getTime(), new Date().getTime());

      cells.push(
        <button
          key={`day-${day}`}
          onClick={() => {
            setSelectedDate(date);
            setShowFullCalendar(false);
          }}
          style={{
            background: isSelected ? 'var(--accent-purple)' : 'transparent',
            border: 'none',
            color: isSelected ? '#fff' : isToday ? 'var(--accent-purple)' : 'var(--text-primary)',
            borderRadius: '50%',
            aspectRatio: '1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: isSelected || isToday ? 'bold' : 'normal',
            position: 'relative',
            padding: '0.2rem',
            width: '100%',
            height: '100%',
            minHeight: '32px',
            outline: 'none',
            boxShadow: isSelected ? '0 0 10px var(--accent-purple-glow)' : 'none',
            transition: 'var(--transition-smooth)'
          }}
        >
          <span>{day}</span>
          {hasLogs && (
            <span style={{
              position: 'absolute',
              bottom: '3px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: isSelected ? '#fff' : 'var(--accent-purple)',
              boxShadow: isSelected ? 'none' : '0 0 4px var(--accent-purple-glow)'
            }} />
          )}
        </button>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <button onClick={handlePrevMonth} className="btn-icon" style={{ width: '28px', height: '28px', padding: 0 }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {currentMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={handleNextMonth} className="btn-icon" style={{ width: '28px', height: '28px', padding: 0 }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.2rem',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {headers}
          {cells}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
      
      {/* 1. Header Toggles (Calendar Mode vs Feed Mode) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{
          fontSize: '1.2rem',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CalendarRange size={18} color="var(--accent-purple)" />
          {viewMode === 'calendar' ? 'Nutrition Calendar' : 'Full Activity Feed'}
        </h3>

        {/* View Mode Selectors */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-glass)',
          borderRadius: '20px',
          padding: '0.15rem'
        }}>
          <button 
            onClick={() => setViewMode('calendar')}
            style={{
              background: viewMode === 'calendar' ? 'var(--accent-purple)' : 'transparent',
              border: 'none',
              color: viewMode === 'calendar' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.35rem 0.75rem',
              borderRadius: '16px',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              transition: 'var(--transition-smooth)'
            }}
          >
            Calendar
          </button>
          <button 
            onClick={() => setViewMode('feed')}
            style={{
              background: viewMode === 'feed' ? 'var(--accent-purple)' : 'transparent',
              border: 'none',
              color: viewMode === 'feed' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.35rem 0.75rem',
              borderRadius: '16px',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              transition: 'var(--transition-smooth)'
            }}
          >
            All Feed
          </button>
        </div>
      </div>

      {/* 2. Calendar Selector Deck (only visible in calendar mode) */}
      {viewMode === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '1rem' }}>
          
          {/* Horizontal Rolling Week Strip & Toggle Grid Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
            
            {/* The Horizontal Days Container */}
            <div style={{
              display: 'flex',
              flex: 1,
              justifyContent: 'space-between',
              gap: '0.35rem',
              overflowX: 'auto',
              scrollbarWidth: 'none', // Hide Firefox scrollbar
              padding: '0.2rem 0'
            }}>
              {horizontalDays.map((day, idx) => {
                const isSelected = isSameDay(day.getTime(), selectedDate.getTime());
                const hasLogs = dayHasLogs(day);
                const isToday = isSameDay(day.getTime(), new Date().getTime());
                const dayAbbr = day.toLocaleDateString([], { weekday: 'short' });
                const dayNum = day.getDate();

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedDate(day);
                      setCurrentMonth(day);
                    }}
                    style={{
                      flex: 1,
                      minWidth: '40px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.15rem',
                      padding: '0.4rem 0.25rem',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--accent-purple)' : 'transparent',
                      background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.01)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)',
                      outline: 'none',
                      color: isSelected ? 'var(--text-primary)' : isToday ? 'var(--accent-purple)' : 'var(--text-secondary)'
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.8, fontWeight: 500, fontFamily: 'var(--font-display)' }}>
                      {dayAbbr}
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                      {dayNum}
                    </span>
                    
                    {/* Logged entry indicator dot */}
                    {hasLogs && (
                      <span style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-purple)',
                        boxShadow: '0 0 6px var(--accent-purple-glow)',
                        marginTop: '1px'
                      }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Month Calendar Toggle Button */}
            <button 
              onClick={() => {
                setShowFullCalendar(!showFullCalendar);
                setCurrentMonth(new Date(selectedDate));
              }}
              className="btn-icon"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                borderColor: showFullCalendar ? 'var(--accent-purple)' : 'var(--border-glass)',
                color: showFullCalendar ? 'var(--accent-purple)' : 'var(--text-secondary)',
                background: showFullCalendar ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255,255,255,0.03)',
                boxShadow: showFullCalendar ? '0 0 10px var(--accent-purple-glow)' : 'none'
              }}
              data-tooltip="Toggle Full Calendar Grid"
            >
              <CalendarDays size={18} />
            </button>
          </div>

          {/* Collapsible Monthly Calendar Board */}
          {showFullCalendar && (
            <div 
              className="glass-card" 
              style={{ 
                padding: '1rem', 
                background: 'rgba(15,16,25,0.95)', 
                borderColor: 'var(--border-glass-glow)', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                animation: 'bottomSheetIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {renderMonthDays()}
            </div>
          )}

          {/* 3. Daily Aggregate Summary Panel (glowing budget overview) */}
          <div 
            className="glass-card" 
            style={{ 
              padding: '0.85rem 1.1rem', 
              borderRadius: '16px',
              backgroundColor: 'rgba(255,255,255,0.01)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.6rem'
            }}
          >
            {/* Header Totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'var(--font-display)' }}>
                  {selectedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
                {onCopyDay && dailyCals > 0 && !isSameDay(selectedDate.getTime(), new Date().getTime()) && (
                  <button
                    onClick={() => onCopyDay(selectedDate.getTime())}
                    aria-label="Copy this day's meals to today"
                    title="Copy meals to today"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.18)',
                      color: 'var(--accent-purple)',
                      borderRadius: '8px',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      fontFamily: 'var(--font-display)',
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    <CopyPlus size={11} /> Copy to today
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-purple)', fontFamily: 'var(--font-display)' }}>
                  {dailyCals}
                </span>
                {goals && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                    / {goals.calories + dailyBurned} kcal
                  </span>
                )}
              </div>
            </div>

            {/* Calorie Budget Bar */}
            {goals && (
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((dailyCals / (goals.calories + dailyBurned)) * 100, 100)}%`,
                  backgroundColor: dailyCals > (goals.calories + dailyBurned) ? 'var(--accent-rose)' : 'var(--accent-purple)',
                  boxShadow: dailyCals > (goals.calories + dailyBurned) ? '0 0 8px var(--accent-rose-glow)' : '0 0 8px var(--accent-purple-glow)',
                  borderRadius: '99px',
                  transition: 'width 0.5s ease-out'
                }} />
              </div>
            )}

            {/* Active Burn expansion helper subtitle */}
            {dailyBurned > 0 && goals && (
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-teal)', fontFamily: 'var(--font-display)', marginTop: '-0.2rem' }}>
                🏃‍♂️ Base Goal: {goals.calories} kcal + Active Burn: {dailyBurned} kcal
              </div>
            )}

            {/* Daily Macro Breakdown Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.1rem' }}>
              
              {/* Protein summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', background: 'rgba(16,185,129,0.02)', padding: '0.35rem 0.5rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-teal)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>Protein</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {Math.round(dailyProtein)}g
                  {goals && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}> / {goals.protein}g</span>}
                </span>
              </div>

              {/* Carbs summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', background: 'rgba(6,182,212,0.02)', padding: '0.35rem 0.5rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>Carbs</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {Math.round(dailyCarbs)}g
                  {goals && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}> / {goals.carbs}g</span>}
                </span>
              </div>

              {/* Fat summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', background: 'rgba(139,92,246,0.02)', padding: '0.35rem 0.5rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>Fat</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {Math.round(dailyFat)}g
                  {goals && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}> / {goals.fat}g</span>}
                </span>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 4. Logs Feed list (shared between date filters and feed view) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxHeight: '480px',
        overflowY: 'auto',
        paddingRight: '0.25rem'
      }}>
        {filteredTimeline.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <EmptyState
              icon={<Activity size={26} />}
              title="No activity logged for this day"
              subtitle={viewMode === 'calendar'
                ? 'Log your first meal or workout using the console above — by voice, photo, or text.'
                : 'Your activity history is currently clear.'}
              actions={viewMode === 'calendar' ? [
                { icon: <Mic size={20} />, label: 'Voice', hint: '~5 sec' },
                { icon: <Camera size={20} />, label: 'Photo', hint: '~3 sec' },
                { icon: <Keyboard size={20} />, label: 'Type', hint: 'anytime' },
              ] : undefined}
            />
            {viewMode === 'calendar' && !isSameDay(selectedDate.getTime(), new Date().getTime()) && (
              <button 
                onClick={() => {
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  setSelectedDate(today);
                  setCurrentMonth(today);
                }}
                className="btn btn-secondary" 
                style={{ marginTop: '0.5rem', padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '12px' }}
              >
                Return to Today
              </button>
            )}
          </div>
        ) : (
          filteredTimeline.map((timelineItem) => {
            if (timelineItem.type === 'food') {
              const log = timelineItem.item as MealLog;
              const mealCals = log.items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
              const mealProtein = log.items.reduce((sum, item) => sum + (Number(item.protein) || 0), 0);
              const mealCarbs = log.items.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
              const mealFat = log.items.reduce((sum, item) => sum + (Number(item.fat) || 0), 0);

              const mealAddedSugar = log.items.reduce((sum, item) => sum + (Number(item.addedSugar) || 0), 0);
              const mealFiber = log.items.reduce((sum, item) => sum + (Number(item.fiber) || 0), 0);
              const mealSodium = log.items.reduce((sum, item) => sum + (Number(item.sodium) || 0), 0);

              const isExpanded = expandedFoodKey === log.id;

              return (
                <div 
                  key={log.id} 
                  className="glass-card" 
                  onClick={() => toggleFoodExpand(log.id)}
                  style={{ 
                    padding: '1.1rem', 
                    borderRadius: '16px',
                    backgroundColor: 'rgba(255,255,255,0.012)',
                    border: '1px solid rgba(255,255,255,0.035)',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {/* Meal Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.85rem',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    paddingBottom: '0.5rem'
                  }}>
                    {/* Category & Time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {getMealIcon(log.mealType)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 655, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                          {getMealHeaderLabel(log.mealType)}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Clock size={10} />
                          {formatTime(log.timestamp)} {viewMode === 'feed' && `• ${formatDate(log.timestamp)}`}
                        </span>
                      </div>
                    </div>

                    {/* Summary Calories & Delete button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-purple)', fontFamily: 'var(--font-display)' }}>
                          {mealCals}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', marginLeft: '0.15rem' }}>
                          kcal
                        </span>
                      </div>
                      
                      {onEditLog && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditLog(log);
                          }}
                          aria-label="Edit this meal"
                          title="Edit meal"
                          style={{
                            background: 'rgba(139, 92, 246, 0.05)',
                            border: '1px solid rgba(139, 92, 246, 0.1)',
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'var(--transition-smooth)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.backgroundColor = 'var(--accent-purple)';
                            e.currentTarget.style.borderColor = 'var(--accent-purple)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)';
                            e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.1)';
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                      )}

                      {onCopyMeal && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyMeal(log);
                          }}
                          aria-label="Copy this meal to today"
                          title="Copy to today"
                          style={{
                            background: 'rgba(6, 182, 212, 0.05)',
                            border: '1px solid rgba(6, 182, 212, 0.1)',
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'var(--transition-smooth)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.backgroundColor = 'var(--accent-teal)';
                            e.currentTarget.style.borderColor = 'var(--accent-teal)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)';
                            e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.1)';
                          }}
                        >
                          <CopyPlus size={12} />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteLog(log.id);
                        }}
                        aria-label="Delete this meal"
                        title="Delete meal"
                        style={{
                          background: 'rgba(244, 63, 94, 0.05)',
                          border: '1px solid rgba(244, 63, 94, 0.1)',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'var(--transition-smooth)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--text-primary)';
                          e.currentTarget.style.backgroundColor = 'var(--accent-rose)';
                          e.currentTarget.style.borderColor = 'var(--accent-rose)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.1)';
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Individual Food Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {log.items.map((item, idx) => (
                      <div 
                        key={idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '0.5rem 0.6rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.008)',
                          border: '1px solid rgba(255, 255, 255, 0.015)',
                          borderRadius: '8px',
                          gap: '0.25rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.quantity}</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.7rem', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                              <span style={{ color: 'var(--accent-teal)' }}>{Math.round(item.protein)}g P</span>
                              <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>|</span>
                              <span style={{ color: 'var(--accent-blue)' }}>{Math.round(item.carbs)}g C</span>
                              <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>|</span>
                              <span style={{ color: 'var(--accent-amber)' }}>{Math.round(item.fat)}g F</span>
                            </div>
                            <span style={{
                              fontSize: '0.8rem',
                              fontWeight: 650,
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-display)',
                              marginLeft: '0.2rem'
                            }}>
                              {item.calories} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>kcal</span>
                            </span>
                          </div>
                        </div>

                        {/* Collapsible item-level micronutrients */}
                        {isExpanded && (
                          <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            fontSize: '0.7rem',
                            color: 'var(--text-secondary)',
                            borderTop: '1px dashed rgba(255,255,255,0.04)',
                            paddingTop: '0.3rem',
                            marginTop: '0.1rem',
                            fontFamily: 'var(--font-display)'
                          }}>
                            <span>🍭 Added Sugar: <strong style={{ color: 'var(--accent-rose)' }}>{item.addedSugar !== undefined ? item.addedSugar : 0}g</strong></span>
                            <span style={{ opacity: 0.3 }}>•</span>
                            <span>🌿 Fiber: <strong style={{ color: 'var(--accent-teal)' }}>{item.fiber !== undefined ? item.fiber : 0}g</strong></span>
                            <span style={{ opacity: 0.3 }}>•</span>
                            <span>🧂 Sodium: <strong style={{ color: 'var(--accent-amber)' }}>{item.sodium !== undefined ? item.sodium : 0}mg</strong></span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Log macros summary */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.6rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    opacity: 0.8
                  }}>
                    {/* Collapsible Prompt indicator */}
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {isExpanded ? '🔼 Click to close micronutrients' : '🔍 Click to view micronutrients'}
                    </span>
                    
                    <div style={{
                      display: 'flex',
                      gap: '0.75rem',
                      fontSize: '0.7rem',
                      color: 'var(--text-secondary)'
                    }}>
                      <span>Protein: <strong style={{ color: 'var(--accent-teal)' }}>{Math.round(mealProtein)}g</strong></span>
                      <span>Carbs: <strong style={{ color: 'var(--accent-blue)' }}>{Math.round(mealCarbs)}g</strong></span>
                      <span>Fat: <strong style={{ color: 'var(--accent-amber)' }}>{Math.round(mealFat)}g</strong></span>
                    </div>
                  </div>

                  {/* Collapsible meal-level micronutrients aggregate */}
                  {isExpanded && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.75rem',
                      fontSize: '0.7rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.5rem',
                      borderTop: '1px solid rgba(255,255,255,0.03)',
                      paddingTop: '0.4rem',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600
                    }}>
                      <span>Added Sugar: <strong style={{ color: 'var(--accent-rose)' }}>{mealAddedSugar}g</strong></span>
                      <span>Fiber: <strong style={{ color: 'var(--accent-teal)' }}>{mealFiber}g</strong></span>
                      <span>Sodium: <strong style={{ color: 'var(--accent-amber)' }}>{mealSodium}mg</strong></span>
                    </div>
                  )}

                </div>
              );
            } else {
              // WORKOUT logs rendered chronologically inline!
              const w = timelineItem.item as WorkoutLog;
              return (
                <div 
                  key={w.id} 
                  className="glass-card" 
                  style={{ 
                    padding: '1.1rem', 
                    borderRadius: '16px',
                    border: '1px solid rgba(6, 182, 212, 0.2)',
                    backgroundColor: 'rgba(6, 182, 212, 0.02)',
                    boxShadow: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}
                >
                  {/* Workout Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    {/* Activity Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(6, 182, 212, 0.08)',
                        border: '1px solid rgba(6, 182, 212, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-teal)'
                      }}>
                        <Activity size={14} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                          {w.activity}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Clock size={10} />
                          {formatTime(w.timestamp)} {viewMode === 'feed' && `• ${formatDate(w.timestamp)}`}
                        </span>
                      </div>
                    </div>

                    {/* Calories Burned & Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-teal)', fontFamily: 'var(--font-display)' }}>
                          -{w.caloriesBurned}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', marginLeft: '0.15rem' }}>
                          kcal
                        </span>
                      </div>
                      
                      {onDeleteWorkout && (
                        <button 
                          onClick={() => onDeleteWorkout(w.id)}
                          style={{
                            background: 'rgba(244, 63, 94, 0.05)',
                            border: '1px solid rgba(244, 63, 94, 0.1)',
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'var(--transition-smooth)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.backgroundColor = 'var(--accent-rose)';
                            e.currentTarget.style.borderColor = 'var(--accent-rose)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)';
                            e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.1)';
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Workout Info body */}
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'rgba(255, 255, 255, 0.005)',
                    padding: '0.5rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.01)'
                  }}>
                    Duration: <strong style={{ color: 'var(--text-primary)' }}>{w.duration} minutes</strong>
                    {w.notes && (
                      <span style={{ display: 'block', marginTop: '0.2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        📝 {w.notes}
                      </span>
                    )}
                  </div>
                </div>
              );
            }
          })
        )}
      </div>

    </div>
  );
};

export default FoodTimeline;
