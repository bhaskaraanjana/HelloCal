import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { MealLog, WorkoutLog, UserGoals, AppSettings, CustomMicro } from '../types/nutrition';
import RingProgress from './ui/RingProgress';
import ProgressBar from './ui/ProgressBar';
import { computeDailyTotals, sumFieldKey } from '../services/dailyTotals';
import { gemini } from '../services/gemini';
import { MICRO_FIELD_ALIASES, DATA_BACKED_MICRO_FIELDS as DATA_BACKED_FIELDS, canonicalMicroUnit } from '../services/sanitize';
import { useDraggablePanels } from '../hooks/useDraggablePanels';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Flame, Trophy, Calendar, Sparkles, GripVertical, SlidersHorizontal, ChevronUp, ChevronDown, X, EyeOff, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

// DATA_BACKED_FIELDS (the FoodItem numeric fields the parser populates — the ONLY
// keys for which we show a consumed value) and the canonical-unit rule live in
// services/sanitize so the add path and the load/heal path stay in lockstep.
const COLOR_PRESETS: { color: string; glowColor: string }[] = [
  { color: 'var(--accent-purple)', glowColor: 'var(--accent-purple-glow)' },
  { color: 'var(--accent-teal)', glowColor: 'var(--accent-teal-glow)' },
  { color: 'var(--accent-amber)', glowColor: 'var(--accent-amber-glow)' },
  { color: 'var(--accent-rose)', glowColor: 'var(--accent-rose-glow)' },
  { color: 'var(--accent-blue)', glowColor: 'var(--accent-blue-glow)' },
];
const MACRO_PRESETS: { label: string; p: number; c: number; f: number }[] = [
  { label: 'Balanced', p: 0.3, c: 0.4, f: 0.3 },
  { label: 'High-Protein', p: 0.4, c: 0.35, f: 0.25 },
  { label: 'Keto', p: 0.25, c: 0.05, f: 0.7 },
  { label: 'Low-Carb', p: 0.35, c: 0.2, f: 0.45 },
];

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
  apiKey?: string;
  onError?: (msg: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  logs,
  workouts = [],
  goals,
  appSettings,
  onTriggerCustomize,
  onSaveGoals,
  onSaveAppSettings,
  apiKey,
  onError,
}) => {
  const {
    todayLogs, todayWorkouts,
    consumedCalories, consumedProtein, consumedCarbs, consumedFat,
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

  // Keyboard-accessible reorder: move a panel one slot among the VISIBLE panels
  // (drag is pointer-only, so arrow keys on the grip are the only a11y path).
  const movePanelByKey = (key: string, dir: -1 | 1) => {
    const vis = panelOrder.filter((k) => (appSettings.visibleWidgets as Record<string, boolean | undefined>)[k] !== false);
    const vi = vis.indexOf(key);
    const vj = vi + dir;
    if (vi < 0 || vj < 0 || vj >= vis.length) return;
    // Translate the visible-list swap back to absolute positions in panelOrder.
    const a = panelOrder.indexOf(vis[vi]);
    const b = panelOrder.indexOf(vis[vj]);
    if (a < 0 || b < 0) return;
    const next = [...panelOrder];
    [next[a], next[b]] = [next[b], next[a]];
    persistOrder(next);
  };

  // --- Per-panel settings drawer ---
  const [settingsKey, setSettingsKey] = useState<string | null>(null);
  const [draftGoals, setDraftGoals] = useState<UserGoals>(goals);
  useEffect(() => { if (settingsKey) setDraftGoals(goals); }, [settingsKey, goals]);

  // Modal hygiene for the settings drawer: trap focus, close on Escape, lock body
  // scroll — matching RefinementModal so the drawer isn't an a11y/scroll regression.
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(!!settingsKey, drawerRef);
  useEffect(() => {
    if (!settingsKey) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsKey(null); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [settingsKey]);

  const applyGoals = () => { onSaveGoals?.(draftGoals); setSettingsKey(null); };
  const patchSettings = (patch: Partial<AppSettings>) => onSaveAppSettings?.({ ...appSettings, ...patch });
  const hidePanel = (key: string) => {
    patchSettings({ visibleWidgets: { ...appSettings.visibleWidgets, [key]: false } });
    setSettingsKey(null);
  };

  // --- Custom micronutrient management ---
  const customMicros = appSettings.customMicros ?? [];
  const [newMicroName, setNewMicroName] = useState('');
  const [fetchingMicro, setFetchingMicro] = useState(false);
  const saveMicros = (micros: CustomMicro[]) => patchSettings({ customMicros: micros });
  const updateMicro = (id: string, patch: Partial<CustomMicro>) => saveMicros(customMicros.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMicro = (id: string) => saveMicros(customMicros.filter((m) => m.id !== id));
  const moveMicro = (id: string, dir: -1 | 1) => {
    const i = customMicros.findIndex((m) => m.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= customMicros.length) return;
    const next = [...customMicros];
    [next[i], next[j]] = [next[j], next[i]];
    saveMicros(next);
  };
  const addMicro = async () => {
    const name = newMicroName.trim();
    if (!name) return;
    setFetchingMicro(true);
    try {
      let info = { name, emoji: '🔬', unit: 'g', dailyLimit: 0, isLimit: false, color: 'var(--accent-purple)', glowColor: 'var(--accent-purple-glow)' };
      if (apiKey) {
        try { info = { ...info, ...(await gemini.fetchMicronutrientInfo(name, apiKey)) }; }
        catch { onError?.('Could not fetch nutrient info — added with defaults.'); }
      }
      const norm = info.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Resolve to the exact camelCase FoodItem key so a backed nutrient ("Added
      // Sugar" -> 'addedSugar') auto-tracks instead of falling into "not tracked".
      const fieldKey = MICRO_FIELD_ALIASES[norm] ?? norm;
      // For data-backed fields the HUD sums the raw FoodItem value (fixed unit:
      // mg for sodium/iron, g otherwise), so force that unit rather than trust the AI.
      const unit = canonicalMicroUnit(fieldKey) ?? (info.unit || 'g');
      saveMicros([...customMicros, {
        id: `micro_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: info.name, emoji: info.emoji || '🔬', unit,
        dailyLimit: Math.max(0, Number(info.dailyLimit) || 0), isLimit: !!info.isLimit,
        color: info.color || 'var(--accent-purple)', glowColor: info.glowColor || 'var(--accent-purple-glow)', fieldKey,
      }]);
      setNewMicroName('');
    } finally {
      setFetchingMicro(false);
    }
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
              {totalBurnedCalories > 0 && appSettings.showBurnBreakdown !== false && (
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
      case 'micros': {
        const shown = customMicros.filter((m) => !m.hidden);
        if (shown.length === 0) {
          return <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No micronutrients yet. Tap ⚙ to add any micro you want to track.</p>;
        }
        return (
          <div>
            {shown.map((m) => {
              if (DATA_BACKED_FIELDS.has(m.fieldKey)) {
                const consumed = sumFieldKey(todayLogs, m.fieldKey);
                const over = m.isLimit && consumed > m.dailyLimit;
                return (
                  <ProgressBar
                    key={m.id}
                    label={`${m.emoji} ${m.name} ${m.isLimit ? '(Limit)' : '(Target)'}`}
                    value={consumed}
                    max={m.dailyLimit || 1}
                    color={over ? 'var(--accent-rose)' : m.color}
                    glowColor={over ? 'var(--accent-rose-glow)' : m.glowColor}
                    unit={m.unit}
                  />
                );
              }
              // Honest: no logged data for this nutrient — show the target, not a fake 0.
              return (
                <div key={m.id} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
                    <span>{m.emoji} {m.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{m.isLimit ? 'Limit' : 'Target'} {m.dailyLimit}{m.unit}</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem', opacity: 0.8 }}>Not auto-tracked from foods yet</div>
                </div>
              );
            })}
          </div>
        );
      }
      case 'mealSlots':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{todayLogs.length}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>meals logged today</span>
            </div>
            {appSettings.showMealBreakdown !== false && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                <span style={{ opacity: breakfastCount > 0 ? 1 : 0.4 }}>🍳 B:{breakfastCount}</span>
                <span style={{ opacity: lunchCount > 0 ? 1 : 0.4 }}>🍱 L:{lunchCount}</span>
                <span style={{ opacity: dinnerCount > 0 ? 1 : 0.4 }}>🥗 D:{dinnerCount}</span>
                <span style={{ opacity: snackCount > 0 ? 1 : 0.4 }}>🍪 S:{snackCount}</span>
              </div>
            )}
          </div>
        );
      case 'goalCompletion': {
        const basis = appSettings.goalScoreBasis || 'calories';
        let pct: number;
        let label: string;
        if (basis === 'macros') {
          const pp = goals.protein ? Math.min(consumedProtein / goals.protein, 1) : 0;
          const cc = goals.carbs ? Math.min(consumedCarbs / goals.carbs, 1) : 0;
          const ff = goals.fat ? Math.min(consumedFat / goals.fat, 1) : 0;
          pct = Math.round(((pp + cc + ff) / 3) * 100);
          label = 'avg macro completion';
        } else if (basis === 'deficit') {
          pct = consumedCalories <= expandedCalorieGoal ? 100 : Math.max(0, Math.round(100 - ((consumedCalories - expandedCalorieGoal) / expandedCalorieGoal) * 100));
          label = 'staying within budget';
        } else {
          pct = Math.min(Math.round((consumedCalories / expandedCalorieGoal) * 100), 100);
          label = "of today's calorie halo";
        }
        return (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--accent-teal)', fontFamily: 'var(--font-display)' }}>{pct}%</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        );
      }
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
    const inputStyle: React.CSSProperties = { padding: '0.45rem 0.6rem', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' };
    const iconBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '7px', background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-muted)', cursor: 'pointer' };

    if (key === 'calorieHalo') {
      const setCal = (cal: number) => { const g = { ...draftGoals, calories: cal }; setDraftGoals(g); onSaveGoals?.(g); };
      return (
        <>
          {numInput('Base calorie target', draftGoals.calories, (n) => setDraftGoals({ ...draftGoals, calories: n }), 'kcal')}
          <button type="button" onClick={applyGoals} className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>Apply</button>
          <div style={{ marginTop: '0.85rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Quick goal</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              {([['Lose', 0.85], ['Maintain', 1], ['Gain', 1.15]] as const).map(([lbl, f]) => (
                <button key={lbl} type="button" onClick={() => setCal(Math.round(((Number(goals.calories) || 2000) * f) / 10) * 10)} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.7rem' }}>{lbl}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: '0.85rem' }}>
            {toggle('Show base + burn breakdown', appSettings.showBurnBreakdown !== false, (v) => patchSettings({ showBurnBreakdown: v }))}
          </div>
          {common}
        </>
      );
    }
    if (key === 'macros') {
      const applyPreset = (p: number, c: number, f: number) => {
        const cal = Number(draftGoals.calories) || 2000;
        const g = { ...draftGoals, protein: Math.round((cal * p) / 4), carbs: Math.round((cal * c) / 4), fat: Math.round((cal * f) / 9) };
        setDraftGoals(g);
        onSaveGoals?.(g);
      };
      return (
        <>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Macro split presets (from calorie target)</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.35rem 0 0.85rem' }}>
            {MACRO_PRESETS.map((pr) => (
              <button key={pr.label} type="button" onClick={() => applyPreset(pr.p, pr.c, pr.f)} className="btn btn-secondary" style={{ fontSize: '0.74rem', padding: '0.35rem 0.6rem' }}>{pr.label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.6rem' }}>
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
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Track any micronutrient — edit limit, emoji, colour, reorder, hide.</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
            {customMicros.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>No micros yet — add one below.</p>}
            {customMicros.map((m, idx) => {
              const backed = DATA_BACKED_FIELDS.has(m.fieldKey);
              return (
                <div key={m.id} style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.6rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input value={m.emoji} maxLength={2} onChange={(e) => updateMicro(m.id, { emoji: e.target.value })} aria-label={`${m.name} emoji`} style={{ ...inputStyle, width: '36px', textAlign: 'center' }} />
                    <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</span>
                    <button type="button" onClick={() => moveMicro(m.id, -1)} disabled={idx === 0} aria-label={`Move ${m.name} up`} style={{ ...iconBtn, opacity: idx === 0 ? 0.4 : 1 }}><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => moveMicro(m.id, 1)} disabled={idx === customMicros.length - 1} aria-label={`Move ${m.name} down`} style={{ ...iconBtn, opacity: idx === customMicros.length - 1 ? 0.4 : 1 }}><ArrowDown size={14} /></button>
                    <button type="button" onClick={() => removeMicro(m.id)} aria-label={`Remove ${m.name}`} style={iconBtn}><Trash2 size={14} /></button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <input type="number" value={m.dailyLimit} onChange={(e) => updateMicro(m.id, { dailyLimit: Math.max(0, Number(e.target.value) || 0) })} aria-label={`${m.name} daily ${m.isLimit ? 'limit' : 'target'}`} style={{ ...inputStyle, width: '78px' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.unit}</span>
                    {toggle(m.isLimit ? 'Limit' : 'Target', m.isLimit, (v) => updateMicro(m.id, { isLimit: v }))}
                    {toggle('Shown', !m.hidden, (v) => updateMicro(m.id, { hidden: v ? undefined : true }))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {COLOR_PRESETS.map((cp) => (
                      <button key={cp.color} type="button" onClick={() => updateMicro(m.id, { color: cp.color, glowColor: cp.glowColor })} aria-label={`Set ${m.name} colour`} style={{ width: '20px', height: '20px', borderRadius: '50%', background: cp.color, border: m.color === cp.color ? '2px solid #fff' : '1px solid var(--border-glass)', cursor: 'pointer', padding: 0 }} />
                    ))}
                    <span style={{ marginLeft: 'auto', fontSize: '0.64rem', color: backed ? 'var(--accent-teal)' : 'var(--text-muted)' }}>{backed ? '✓ tracked from foods' : 'manual only'}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input value={newMicroName} onChange={(e) => setNewMicroName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addMicro(); } }} placeholder={apiKey ? 'Add micro — AI fills details (e.g. Potassium)' : 'Add micro (e.g. Iron)'} aria-label="New micronutrient name" disabled={fetchingMicro} style={{ ...inputStyle, flex: 1 }} />
            <button type="button" onClick={() => void addMicro()} disabled={fetchingMicro || !newMicroName.trim()} className="btn btn-primary" aria-label="Add micronutrient" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', opacity: fetchingMicro || !newMicroName.trim() ? 0.6 : 1 }}>
              {apiKey ? <Sparkles size={14} /> : <Plus size={14} />}{fetchingMicro ? '…' : 'Add'}
            </button>
          </div>
          {common}
        </>
      );
    }
    if (key === 'mealSlots') {
      return (
        <>
          {toggle('Show meal-slot breakdown (B/L/D/S)', appSettings.showMealBreakdown !== false, (v) => patchSettings({ showMealBreakdown: v }))}
          {common}
        </>
      );
    }
    if (key === 'goalCompletion') {
      const basis = appSettings.goalScoreBasis || 'calories';
      return (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span>Score basis</span>
            <select value={basis} onChange={(e) => patchSettings({ goalScoreBasis: e.target.value as AppSettings['goalScoreBasis'] })} style={inputStyle}>
              <option value="calories">Calories vs halo</option>
              <option value="macros">Average macro completion</option>
              <option value="deficit">Staying within budget</option>
            </select>
          </label>
          {common}
        </>
      );
    }
    if (key === 'workouts') {
      return (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Today's active burn: <strong style={{ color: 'var(--accent-teal)' }}>-{totalBurnedCalories} kcal</strong> across {totalWorkoutMinutes} min.
          </p>
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
        <GripVertical size={12} /> Drag the handle (or focus it and press ↑/↓) to reorder · tap a title to collapse · ⚙ for per-panel settings
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
                  aria-label={`Drag ${meta.title} panel (press arrow up or down to reorder)`}
                  onPointerDown={handlePointerDown(key)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') { e.preventDefault(); movePanelByKey(key, -1); }
                    else if (e.key === 'ArrowDown') { e.preventDefault(); movePanelByKey(key, 1); }
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', flexShrink: 0, borderRadius: '9px', background: 'rgba(139,92,246,0.1)', border: '1px solid var(--border-glass)', color: 'var(--text-muted)', cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
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
                <button type="button" onClick={() => setSettingsKey(key)} aria-label={`${meta.title} settings`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', flexShrink: 0, borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <SlidersHorizontal size={15} />
                </button>
                <button type="button" onClick={() => toggleCollapse(key)} aria-label={isCollapsed ? `Expand ${meta.title}` : `Collapse ${meta.title}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', flexShrink: 0, borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
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

      {/* Restore hidden panels */}
      {DEFAULT_ORDER.some((k) => (appSettings.visibleWidgets as Record<string, boolean | undefined>)[k] === false) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>Hidden:</span>
          {DEFAULT_ORDER.filter((k) => (appSettings.visibleWidgets as Record<string, boolean | undefined>)[k] === false).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => patchSettings({ visibleWidgets: { ...appSettings.visibleWidgets, [k]: true } })}
              aria-label={`Restore ${PANEL_META[k].title} panel`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: '99px', fontSize: '0.74rem', fontWeight: 600, background: 'rgba(139,92,246,0.08)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <Plus size={12} /> {PANEL_META[k].title}
            </button>
          ))}
        </div>
      )}

      {/* Per-panel settings drawer (bottom-sheet on mobile via CSS) */}
      {settingsKey && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`${PANEL_META[settingsKey as PanelKey].title} settings`} onClick={() => setSettingsKey(null)}>
          <div ref={drawerRef} className="panel-settings-drawer" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-secondary, #131520)', border: '1px solid var(--border-glass)', borderRadius: '18px', padding: '1.25rem', width: '420px', maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto' }}>
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
