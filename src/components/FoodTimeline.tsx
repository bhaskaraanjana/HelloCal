import React, { useState } from 'react';
import type { MealLog, UserGoals } from '../types/nutrition';
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
  Activity
} from 'lucide-react';

interface FoodTimelineProps {
  logs: MealLog[];
  onDeleteLog: (id: string) => void;
  goals?: UserGoals;
}

export const FoodTimeline: React.FC<FoodTimelineProps> = ({ logs, onDeleteLog, goals }) => {
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
    return logs.some(log => isSameDay(log.timestamp, date.getTime()));
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

  // Filter logs based on selection mode
  const filteredLogs = logs
    .filter(log => {
      if (viewMode === 'feed') return true;
      return isSameDay(log.timestamp, selectedDate.getTime());
    })
    .sort((a, b) => b.timestamp - a.timestamp); // newest first

  // Compute selected day totals
  let dailyCals = 0;
  let dailyProtein = 0;
  let dailyCarbs = 0;
  let dailyFat = 0;

  if (viewMode === 'calendar') {
    filteredLogs.forEach(log => {
      log.items.forEach(item => {
        dailyCals += Number(item.calories) || 0;
        dailyProtein += Number(item.protein) || 0;
        dailyCarbs += Number(item.carbs) || 0;
        dailyFat += Number(item.fat) || 0;
      });
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'var(--font-display)' }}>
                {selectedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-purple)', fontFamily: 'var(--font-display)' }}>
                  {dailyCals}
                </span>
                {goals && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                    / {goals.calories} kcal
                  </span>
                )}
              </div>
            </div>

            {/* Calorie Budget Bar */}
            {goals && (
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((dailyCals / goals.calories) * 100, 100)}%`,
                  backgroundColor: dailyCals > goals.calories ? 'var(--accent-rose)' : 'var(--accent-purple)',
                  boxShadow: dailyCals > goals.calories ? '0 0 8px var(--accent-rose-glow)' : '0 0 8px var(--accent-purple-glow)',
                  borderRadius: '99px',
                  transition: 'width 0.5s ease-out'
                }} />
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
        {filteredLogs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3.5rem 1rem',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.015)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-glass)'
            }}>
              <Activity size={24} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>No food logged for this day</span>
              <span style={{ fontSize: '0.8rem', maxWidth: '280px', margin: '0 auto', lineHeight: '1.4' }}>
                {viewMode === 'calendar' ? 'Speak or type your intake in the console above to fill this date!' : 'Your activity history is currently clear.'}
              </span>
            </div>
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
          filteredLogs.map((log) => {
            const mealCals = log.items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
            const mealProtein = log.items.reduce((sum, item) => sum + (Number(item.protein) || 0), 0);
            const mealCarbs = log.items.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
            const mealFat = log.items.reduce((sum, item) => sum + (Number(item.fat) || 0), 0);

            return (
              <div 
                key={log.id} 
                className="glass-card" 
                style={{ 
                  padding: '1.1rem', 
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255,255,255,0.012)',
                  border: '1px solid rgba(255,255,255,0.035)',
                  boxShadow: 'none'
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
                      <span style={{ fontSize: '0.9rem', fontWeight: 650, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
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
                    
                    <button 
                      onClick={() => onDeleteLog(log.id)}
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
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.4rem 0.6rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.008)',
                        border: '1px solid rgba(255, 255, 255, 0.015)',
                        borderRadius: '8px'
                      }}
                    >
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
                  ))}
                </div>

                {/* Log macros summary */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.6rem',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  opacity: 0.8
                }}>
                  <span>Protein: <strong style={{ color: 'var(--accent-teal)' }}>{Math.round(mealProtein)}g</strong></span>
                  <span>Carbs: <strong style={{ color: 'var(--accent-blue)' }}>{Math.round(mealCarbs)}g</strong></span>
                  <span>Fat: <strong style={{ color: 'var(--accent-amber)' }}>{Math.round(mealFat)}g</strong></span>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default FoodTimeline;
