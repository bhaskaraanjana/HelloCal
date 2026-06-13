import React, { useMemo, useState, useEffect } from 'react';
import type { MealLog, WorkoutLog, UserGoals, AppSettings } from '../types/nutrition';
import RingProgress from './ui/RingProgress';
import ProgressBar from './ui/ProgressBar';
import { computeDailyTotals } from '../services/dailyTotals';
import { useDraggablePanels } from '../hooks/useDraggablePanels';
import { Flame, Trophy, Calendar, Sparkles, GripVertical, SlidersHorizontal, ChevronUp, ChevronDown, X, EyeOff } from 'lucide-react';

type PanelKey = 'calorieHalo' | 'macros' | 'micros' | 'mealSlots' | 'goalCompletion' | 'workouts';
const DEFAULT_ORDER: PanelKey[] = ['calorieHalo', 'macros', 'micros', 'mealSlots', 'goalCompletion', 'workouts'];
const ORDER_KEY = 'hellocal_dashboard_order';
const COLLAPSE_KEY = 'hellocal_dashboard_collapsed';

interface DashboardProps {
  logs: MealLog[];
  workouts?: WorkoutLog[];
  goals: UserGoals;
  appSettings: AppSettings;
  onTriggerCustomize: (scope: 'general' | 'macronutrients' | 'micronutrients' | 'widgets') => void;
  onSaveGoals?: (goals: UserGoals) => void;
  onSaveAppSettings?: (settings: AppSettings) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  logs,
  workouts = [],
  goals,
  appSettings,
  onTriggerCustomize,
  onSaveGoals,
  onSaveAppSettings,
}) => {
  const {
    todayLogs, todayWorkouts,
    consumedCalories, consumedProtein, consumedCarbs, consumedFat,
    consumedAddedSugar, consumedFiber, consumedSodium,
    totalBurnedCalories, totalWorkoutMinutes,
    breakfastCount, lunchCount, dinnerCount, snackCount,
  } = useMemo(() => computeDailyTotals(logs, workouts), [logs, workouts]);

  const baseCalorieGoal = Number(goals.calories) || 2000;
  const expandedCalorieGoal = baseCalorieGoal + totalBurnedCalories;
  const remainingCalories = Math.max(expandedCalorieGoal - consumedCalories, 0);
  const isOverBudget = consumedCalories > expandedCalorieGoal;
  const overBudgetCals = consumedCalories - expandedCalorieGoal;

  // --- Panel layout state (device-local UI prefs, self-healing) ---
  const [panelOrder, setPanelOrder] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null');
      if (Array.isArray(saved)) {
        const known = saved.filter((k) => (DEFAULT_ORDER as string[]).includes(k));
        const missing = DEFAULT_ORDER.filter((k) => !known.includes(k));
        return [...known, ...missing];
      }
    } catch { /* ignore */ }
    return [...DEFAULT_ORDER];
  });
  const persistOrder = (next: string[]) => {
    setPanelOrder(next);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}') || {}; } catch { return {}; }
  });
  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const { draggedKey, handlePointerDown, handlePointerMove, endDrag } = useDraggablePanels(panelOrder, persistOrder);

  // --- Per-panel settings drawer ---
  const [settingsKey, setSettingsKey] = useState<string | null>(null);
  const [draftGoals, setDraftGoals] = useState<UserGoals>(goals);
  useEffect(() => { if (settingsKey) setDraftGoals(goals); }, [settingsKey, goals]);

  const applyGoals = () => { onSaveGoals?.(draftGoals); setSettingsKey(null); };
  const patchSettings = (patch: Partial<AppSettings>) => onSaveAppSettings?.({ ...appSettings, ...patch });
  const hidePanel = (key: string) => {
    patchSettings({ visibleWidgets: { ...appSettings.visibleWidgets, [key]: false } });
    setSettingsKey(null);
  };

  const PANEL_META: Record<PanelKey, { title: string; icon: React.ReactNode; customize: 'general' | 'macronutrients' | 'micronutrients' | 'widgets' }> = {
    calorieHalo: { title: 'Daily Halo', icon: <Flame size={16} color="var(--accent-purple)" />, customize: 'general' },
    macros: { title: 'Macronutrients', icon: <Trophy size={16} color="var(--accent-amber)" />, customize: 'macronutrients' },
    micros: { title: 'Micronutrients', icon: <Sparkles size={16} color="var(--accent-purple)" />, customize: 'micronutrients' },
    mealSlots: { title: 'Meals Today', icon: <Calendar size={16} color="var(--accent-amber)" />, customize: 'widgets' },
    goalCompletion: { title: 'Goal Completion', icon: <Trophy size={16} color="var(--accent-teal)" />, customize: 'widgets' },
    workouts: { title: 'Workouts', icon: <Flame size={16} color="var(--accent-teal)" />, customize: 'widgets' },
  };

  // ---- Panel bodies ----
  const numInput = (label: string, value: number | undefined, onChange: (n: number) => void, unit = '') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
      <span>{label}{unit ? ` (${unit})` : ''}</span>
      <input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={{ padding: '0.5rem 0.7rem', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }} />
    </label>
  );
  const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: '17px', height: '17px', accentColor: 'var(--accent-purple)' }} />
      {label}
    </label>
  );

  const renderBody = (key: PanelKey): React.ReactNode => {
    switch (key) {
      case 'calorieHalo':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0' }}>
            <RingProgress value={consumedCalories} max={expandedCalorieGoal} size={200} strokeWidth={16} color="var(--accent-purple)" glowColor="var(--accent-purple-glow)">
              <span style={{ fontSize: '2.3rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: isOverBudget ? 'var(--accent-rose)' : 'var(--text-primary)', lineHeight: 1 }}>
                {isOverBudget ? `+${overBudgetCals}` : remainingCalories}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isOverBudget ? 'kcal over' : 'kcal left'}
              </span>
            </RingProgress>
            <div style={{ marginTop: '1.25rem', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Logged <strong style={{ color: 'var(--text-primary)' }}>{consumedCalories} kcal</strong> of your <strong style={{ color: 'var(--text-primary)' }}>{expandedCalorieGoal} kcal</strong> halo.
              {totalBurnedCalories > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-teal)', marginTop: '0.25rem' }}>🏃 Base {baseCalorieGoal} + Burn {totalBurnedCalories} kcal</div>
              )}
            </div>
          </div>
        );
      case 'macros':
        return (
          <div>
            {appSettings.visibleMacros.protein && <ProgressBar label="🍗 Protein" value={consumedProtein} max={goals.protein} color="var(--accent-teal)" glowColor="var(--accent-teal-glow)" />}
            {appSettings.visibleMacros.fat && <ProgressBar label="🥑 Fats" value={consumedFat} max={goals.fat} color="var(--accent-amber)" glowColor="var(--accent-amber-glow)" />}
            {appSettings.visibleMacros.carbs && <ProgressBar label="🌾 Carbohydrates" value={consumedCarbs} max={goals.carbs} color="var(--accent-blue)" glowColor="var(--accent-blue-glow)" />}
          </div>
        );
      case 'micros':
        return (
          <div>
            {appSettings.visibleMicros.addedSugar && <ProgressBar label="🍭 Added Sugar (Limit)" value={consumedAddedSugar} max={goals.addedSugar || 30} color={consumedAddedSugar > (goals.addedSugar || 30) ? 'var(--accent-rose)' : 'var(--accent-purple)'} glowColor={consumedAddedSugar > (goals.addedSugar || 30) ? 'var(--accent-rose-glow)' : 'var(--accent-purple-glow)'} />}
            {appSettings.visibleMicros.fiber && <ProgressBar label="🌿 Dietary Fiber (Target)" value={consumedFiber} max={goals.fiber || 30} color="var(--accent-teal)" glowColor="var(--accent-teal-glow)" />}
            {appSettings.visibleMicros.sodium && <ProgressBar label="🧂 Sodium (Limit)" value={consumedSodium} max={goals.sodium || 2300} color={consumedSodium > (goals.sodium || 2300) ? 'var(--accent-rose)' : 'var(--accent-amber)'} glowColor={consumedSodium > (goals.sodium || 2300) ? 'var(--accent-rose-glow)' : 'var(--accent-amber-glow)'} unit="mg" />}
          </div>
        );
      case 'mealSlots':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{todayLogs.length}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>meals logged today</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
              <span style={{ opacity: breakfastCount > 0 ? 1 : 0.4 }}>🍳 B:{breakfastCount}</span>
              <span style={{ opacity: lunchCount > 0 ? 1 : 0.4 }}>🍱 L:{lunchCount}</span>
              <span style={{ opacity: dinnerCount > 0 ? 1 : 0.4 }}>🥗 D:{dinnerCount}</span>
              <span style={{ opacity: snackCount > 0 ? 1 : 0.4 }}>🍪 S:{snackCount}</span>
            </div>
          </div>
        );
      case 'goalCompletion':
        return (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--accent-teal)', fontFamily: 'var(--font-display)' }}>
              {Math.min(Math.round((consumedCalories / expandedCalorieGoal) * 100), 100)}%
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>of today's calorie halo</span>
          </div>
        );
      case 'workouts':
        return todayWorkouts.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No workouts logged today. Log one above to expand your calorie halo.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {todayWorkouts.map((w) => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.7rem 0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{w.activity}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{w.duration} min{w.notes ? ` · ${w.notes}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-teal)' }}>-{w.caloriesBurned}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>kcal</span>
                </div>
              </div>
            ))}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right', borderTop: '1px solid var(--border-glass)', paddingTop: '0.6rem' }}>
              Total burn <strong style={{ color: 'var(--accent-teal)' }}>-{totalBurnedCalories} kcal</strong> · {totalWorkoutMinutes} min
            </div>
          </div>
        );
    }
  };

  const renderSettings = (key: PanelKey): React.ReactNode => {
    const common = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.85rem' }}>
        <button type="button" onClick={() => { onTriggerCustomize(PANEL_META[key].customize); setSettingsKey(null); }} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <Sparkles size={14} /> AI customize (voice / text)
        </button>
        <button type="button" onClick={() => hidePanel(key)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <EyeOff size={14} /> Hide this panel
        </button>
      </div>
    );
    if (key === 'calorieHalo') {
      return (
        <>
          {numInput('Base calorie target', draftGoals.calories, (n) => setDraftGoals({ ...draftGoals, calories: n }), 'kcal')}
          <button type="button" onClick={applyGoals} className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>Apply</button>
          {common}
        </>
      );
    }
    if (key === 'macros') {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.6rem' }}>
            {numInput('Protein', draftGoals.protein, (n) => setDraftGoals({ ...draftGoals, protein: n }), 'g')}
            {numInput('Carbs', draftGoals.carbs, (n) => setDraftGoals({ ...draftGoals, carbs: n }), 'g')}
            {numInput('Fat', draftGoals.fat, (n) => setDraftGoals({ ...draftGoals, fat: n }), 'g')}
          </div>
          <button type="button" onClick={applyGoals} className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>Apply targets</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.85rem' }}>
            {toggle('Show protein', appSettings.visibleMacros.protein, (v) => patchSettings({ visibleMacros: { ...appSettings.visibleMacros, protein: v } }))}
            {toggle('Show carbs', appSettings.visibleMacros.carbs, (v) => patchSettings({ visibleMacros: { ...appSettings.visibleMacros, carbs: v } }))}
            {toggle('Show fat', appSettings.visibleMacros.fat, (v) => patchSettings({ visibleMacros: { ...appSettings.visibleMacros, fat: v } }))}
          </div>
          {common}
        </>
      );
    }
    if (key === 'micros') {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.6rem' }}>
            {numInput('Added sugar', draftGoals.addedSugar, (n) => setDraftGoals({ ...draftGoals, addedSugar: n }), 'g')}
            {numInput('Fiber', draftGoals.fiber, (n) => setDraftGoals({ ...draftGoals, fiber: n }), 'g')}
            {numInput('Sodium', draftGoals.sodium, (n) => setDraftGoals({ ...draftGoals, sodium: n }), 'mg')}
          </div>
          <button type="button" onClick={applyGoals} className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>Apply targets</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.85rem' }}>
            {toggle('Show added sugar', appSettings.visibleMicros.addedSugar, (v) => patchSettings({ visibleMicros: { ...appSettings.visibleMicros, addedSugar: v } }))}
            {toggle('Show fiber', appSettings.visibleMicros.fiber, (v) => patchSettings({ visibleMicros: { ...appSettings.visibleMicros, fiber: v } }))}
            {toggle('Show sodium', appSettings.visibleMicros.sodium, (v) => patchSettings({ visibleMicros: { ...appSettings.visibleMicros, sodium: v } }))}
          </div>
          {common}
        </>
      );
    }
    return <>{common}</>;
  };

  const visibleOrder = panelOrder.filter((k) => (appSettings.visibleWidgets as Record<string, boolean | undefined>)[k] !== false) as PanelKey[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* First-log nudge (rendered outside the panel grid so it's always present). */}
      {todayLogs.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem', borderRadius: '14px', background: 'rgba(139, 92, 246, 0.06)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'var(--font-display)' }}>
          <Sparkles size={16} color="var(--accent-purple)" style={{ flexShrink: 0 }} />
          <span>Quick start: tap the mic, type a food, scan a barcode, or use Quick Add above to log your first meal.</span>
        </div>
      )}

      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <GripVertical size={12} /> Drag the handle to reorder · tap a title to collapse · ⚙ for per-panel settings
      </p>

      <div className="dashboard-panel-grid">
        {visibleOrder.map((key) => {
          const meta = PANEL_META[key];
          const isCollapsed = !!collapsed[key];
          const isDragged = draggedKey === key;
          return (
            <div
              key={key}
              data-panel-key={key}
              className="glass-card dashboard-panel"
              style={{
                padding: '1.1rem 1.25rem 1.25rem',
                position: 'relative',
                opacity: isDragged ? 0.5 : 1,
                transform: isDragged ? 'scale(0.97)' : 'none',
                border: isDragged ? '1px solid var(--accent-purple)' : undefined,
                boxShadow: isDragged ? '0 12px 40px var(--accent-purple-glow)' : undefined,
                transition: 'opacity 0.15s, transform 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: isCollapsed ? 0 : '0.85rem' }}>
                <button
                  type="button"
                  className="dashboard-icon-pill"
                  aria-label={`Drag ${meta.title} panel`}
                  onPointerDown={handlePointerDown(key)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', flexShrink: 0, borderRadius: '9px', background: 'rgba(139,92,246,0.1)', border: '1px solid var(--border-glass)', color: 'var(--text-muted)', cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  <GripVertical size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleCollapse(key)}
                  aria-expanded={!isCollapsed}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.45rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}
                >
                  {meta.icon}
                  {meta.title}
                </button>
                <button type="button" onClick={() => setSettingsKey(key)} aria-label={`${meta.title} settings`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', flexShrink: 0, borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <SlidersHorizontal size={15} />
                </button>
                <button type="button" onClick={() => toggleCollapse(key)} aria-label={isCollapsed ? `Expand ${meta.title}` : `Collapse ${meta.title}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', flexShrink: 0, borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
              <div style={{ maxHeight: isCollapsed ? 0 : '1400px', opacity: isCollapsed ? 0 : 1, overflow: 'hidden', transition: 'max-height 0.3s ease, opacity 0.2s ease' }}>
                {renderBody(key)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-panel settings drawer (bottom-sheet on mobile via CSS) */}
      {settingsKey && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`${PANEL_META[settingsKey as PanelKey].title} settings`} onClick={() => setSettingsKey(null)}>
          <div className="panel-settings-drawer" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-secondary, #131520)', border: '1px solid var(--border-glass)', borderRadius: '18px', padding: '1.25rem', width: '420px', maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="bottom-sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                {PANEL_META[settingsKey as PanelKey].icon}
                {PANEL_META[settingsKey as PanelKey].title} settings
              </h3>
              <button type="button" onClick={() => setSettingsKey(null)} aria-label="Close" className="btn-icon" style={{ borderRadius: '50%', width: '32px', height: '32px' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {renderSettings(settingsKey as PanelKey)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Dashboard;
