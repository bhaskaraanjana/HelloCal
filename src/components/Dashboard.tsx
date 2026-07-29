import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MealLog, WorkoutLog, UserGoals, AppSettings, CustomMicro, WaterLog, Supplement } from '../types/nutrition';
import RingProgress from './ui/RingProgress';
import ProgressBar from './ui/ProgressBar';
import { HydrationTracker } from './HydrationTracker';
import { SupplementTracker } from './SupplementTracker';
import { computeDailyTotals, sumFieldKey } from '../services/dailyTotals';
import { updateNutrientGoals } from '../services/nutritionMath';
import { gemini } from '../services/gemini';
import { MICRO_FIELD_ALIASES, DATA_BACKED_MICRO_FIELDS as DATA_BACKED_FIELDS, canonicalMicroUnit, canonicalMicroFieldKey } from '../services/sanitize';
import { MACRO_TRACKING_ROWS, type MacroGoalKey } from '../services/trackingCatalog';
import { useDraggablePanels } from '../hooks/useDraggablePanels';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Flame, Trophy, Sparkles, SlidersHorizontal, ChevronUp, ChevronDown, X, EyeOff, Plus, Trash2, ArrowUp, ArrowDown, Palette, Droplet, Pill } from 'lucide-react';
import { isAiReady, type AiAccess } from '../services/aiRuntime';

const SETTINGS_CARD: React.CSSProperties = {
  border: '1px solid var(--border-glass)',
  borderRadius: '10px',
  padding: '0.6rem 0.7rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function resolveCssColor(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (typeof document === 'undefined') return '#8b5cf6';
  const probe = document.createElement('span');
  probe.style.color = color;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const parts = rgb.match(/\d+/g);
  if (!parts || parts.length < 3) return '#8b5cf6';
  return rgbToHex(+parts[0], +parts[1], +parts[2]);
}

function hexToGlow(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.4)`;
}

const MicroColorButton: React.FC<{
  color: string;
  onPick: (color: string, glowColor: string) => void;
  iconBtnStyle: React.CSSProperties;
}> = ({ color, onPick, iconBtnStyle }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const hex = useMemo(() => resolveCssColor(color), [color]);
  return (
    <>
      <button
        type="button"
        aria-label="Pick colour"
        onClick={() => inputRef.current?.click()}
        style={{ ...iconBtnStyle, position: 'relative' }}
      >
        <Palette size={14} />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 3,
            right: 3,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            border: '1px solid var(--border-glass)',
          }}
        />
      </button>
      <input
        ref={inputRef}
        type="color"
        className="micro-color-input"
        value={hex}
        onChange={(e) => onPick(e.target.value, hexToGlow(e.target.value))}
        tabIndex={-1}
        aria-hidden
      />
    </>
  );
};

// DATA_BACKED_FIELDS (the FoodItem numeric fields the parser populates — the ONLY
// keys for which we show a consumed value) and the canonical-unit rule live in
// services/sanitize so the add path and the load/heal path stay in lockstep.
const MACRO_PRESETS: { label: string; p: number; c: number; f: number }[] = [
  { label: 'Balanced', p: 0.3, c: 0.4, f: 0.3 },
  { label: 'High-Protein', p: 0.4, c: 0.35, f: 0.25 },
  { label: 'Keto', p: 0.25, c: 0.05, f: 0.7 },
  { label: 'Low-Carb', p: 0.35, c: 0.2, f: 0.45 },
];

type PanelKey = 'calorieHalo' | 'macros' | 'micros' | 'water' | 'supplements';
const DEFAULT_ORDER: PanelKey[] = ['calorieHalo', 'water', 'macros', 'micros', 'supplements'];
const HERO_PANEL_KEYS: PanelKey[] = ['calorieHalo', 'water'];
const SECONDARY_PANEL_KEYS: PanelKey[] = ['macros', 'micros', 'supplements'];
const ORDER_KEY = 'hellocal_dashboard_order';
const COLLAPSE_KEY = 'hellocal_dashboard_collapsed';

interface DashboardProps {
  logs: MealLog[];
  workouts?: WorkoutLog[];
  goals: UserGoals;
  appSettings: AppSettings;
  onSaveGoals?: (goals: UserGoals) => void;
  onSaveAppSettings?: (settings: AppSettings) => void;
  aiAccess?: AiAccess;
  onError?: (msg: string) => void;
  waterLogs?: WaterLog[];
  onAddWater?: (ml: number) => void;
  onRemoveWater?: (id: string) => void;
  supplements?: Supplement[];
  onSaveSupplements?: (supplements: Supplement[]) => void;
  onToggleSupplement?: (id: string) => void;
  voiceSlot?: React.ReactNode;
  mealPresetsSlot?: React.ReactNode;
}

export const Dashboard: React.FC<DashboardProps> = ({
  logs,
  workouts = [],
  goals,
  appSettings,
  onSaveGoals,
  onSaveAppSettings,
  aiAccess,
  onError,
  waterLogs = [],
  onAddWater,
  onRemoveWater,
  supplements = [],
  onSaveSupplements,
  onToggleSupplement,
  voiceSlot,
  mealPresetsSlot,
}) => {
  const {
    todayLogs,
    consumedCalories, consumedProtein, consumedCarbs, consumedFat,
    totalBurnedCalories,
    breakfastCount, lunchCount, dinnerCount, snackCount,
  } = useMemo(() => computeDailyTotals(logs, workouts, Date.now(), supplements), [logs, workouts, supplements]);

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

  const { draggedKey, handlePointerDown, handlePointerMove, endDrag, consumeWasDragged } = useDraggablePanels(panelOrder, persistOrder);

  // Keyboard-accessible reorder: move a panel one slot among the VISIBLE panels.
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

  // Modal hygiene for the settings drawer: trap focus, close on Escape.
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(!!settingsKey && settingsKey !== 'supplements', drawerRef);
  useEffect(() => {
    if (!settingsKey || settingsKey === 'supplements') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsKey(null); };
    document.addEventListener('keydown', onKey);
    const mobile = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches;
    const prevOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      if (mobile) document.body.style.overflow = prevOverflow;
    };
  }, [settingsKey]);

  const applyGoals = () => { onSaveGoals?.(draftGoals); setSettingsKey(null); };
  const patchSettings = (patch: Partial<AppSettings>) => onSaveAppSettings?.({ ...appSettings, ...patch });
  const macroVisible = (k: MacroGoalKey) => {
    if (k === 'protein') return appSettings.visibleMacros.protein;
    if (k === 'carbs') return appSettings.visibleMacros.carbs;
    if (k === 'fat') return appSettings.visibleMacros.fat;
    return !!appSettings.visibleMacros[k];
  };
  const macroIsLimitMode = (k: MacroGoalKey) => {
    const stored = appSettings.macroIsLimit?.[k];
    if (stored !== undefined) return stored;
    return MACRO_TRACKING_ROWS.find((r) => r.goalKey === k)?.defaultIsLimit ?? false;
  };
  const setMacroIsLimit = (k: MacroGoalKey, isLimit: boolean) => {
    patchSettings({ macroIsLimit: { ...appSettings.macroIsLimit, [k]: isLimit } });
  };
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
      const access = aiAccess ?? { provider: 'custom', customApiKey: '', cloudSignedIn: false };
      if (isAiReady(access)) {
        try { info = { ...info, ...(await gemini.fetchMicronutrientInfo(name, access)) }; }
        catch { onError?.('Could not fetch nutrient info — added with defaults.'); }
      }
      const norm = info.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Resolve to the exact camelCase FoodItem key so a backed nutrient ("Added
      // Sugar" -> 'addedSugar') auto-tracks instead of falling into "not tracked".
      const fieldKey = canonicalMicroFieldKey(MICRO_FIELD_ALIASES[norm] ?? norm);
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

  const PANEL_META: Record<PanelKey, { title: string; icon: React.ReactNode }> = {
    calorieHalo: { title: "Today's Calories", icon: <Flame size={16} color="var(--accent-purple)" /> },
    macros: { title: 'Macronutrients', icon: <Trophy size={16} color="var(--accent-amber)" /> },
    micros: { title: 'Micronutrients', icon: <Sparkles size={16} color="var(--accent-purple)" /> },
    water: { title: 'Water Tracker', icon: <Droplet size={16} color="var(--hydration-color)" /> },
    supplements: { title: 'Supplements', icon: <Pill size={16} color="var(--accent-purple)" /> },
  };

  // ---- Panel bodies ----
  const numInput = (label: string, value: number | undefined, onChange: (n: number) => void, unit = '') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
      <span>{label}{unit ? ` (${unit})` : ''}</span>
      <input
        type="number"
        className="panel-settings-input"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
  const showCheckbox = (checked: boolean, onChange: (v: boolean) => void, ariaLabel: string) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
      style={{ width: '17px', height: '17px', accentColor: 'var(--accent-purple)', flexShrink: 0, cursor: 'pointer' }}
    />
  );
  const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: '17px', height: '17px', accentColor: 'var(--accent-purple)' }} />
      {label}
    </label>
  );
  const limitTargetToggle = (isLimit: boolean, onChange: (v: boolean) => void, groupLabel = 'Limit or target') => (
    <div role="group" aria-label={groupLabel} style={{ display: 'inline-flex', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
      {(['Limit', 'Target'] as const).map((mode, i) => {
        const active = i === 0 ? isLimit : !isLimit;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(i === 0)}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--accent-purple)' : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {mode}
          </button>
        );
      })}
    </div>
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
              Logged <strong style={{ color: 'var(--text-primary)' }}>{consumedCalories} kcal</strong> of your <strong style={{ color: 'var(--text-primary)' }}>{expandedCalorieGoal} kcal</strong> goal.
            </div>
          </div>
        );
      case 'macros': {
        const macroConsumed: Record<MacroGoalKey, number> = {
          protein: consumedProtein,
          carbs: consumedCarbs,
          fat: consumedFat,
          saturatedFat: sumFieldKey(logs, 'saturatedFat', Date.now(), supplements),
          transFat: sumFieldKey(logs, 'transFat', Date.now(), supplements),
        };
        return (
          <div>
            {MACRO_TRACKING_ROWS.filter((row) => macroVisible(row.visibleKey)).map((row) => {
              const consumed = macroConsumed[row.goalKey];
              const max = goals[row.goalKey] ?? row.defaultGoal;
              const isLimit = macroIsLimitMode(row.goalKey);
              const over = isLimit && consumed > max;
              return (
                <ProgressBar
                  key={row.goalKey}
                  label={`${row.emoji} ${row.name} ${isLimit ? '(Limit)' : '(Target)'}`}
                  value={consumed}
                  max={max}
                  color={over ? 'var(--accent-rose)' : row.color}
                  glowColor={over ? 'var(--accent-rose-glow)' : row.glowColor}
                />
              );
            })}
          </div>
        );
      }
      case 'micros': {
        const shown = customMicros.filter((m) => !m.hidden);
        if (shown.length === 0) {
          return <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No micronutrients yet. Tap ⚙ to add any micro you want to track.</p>;
        }
        return (
          <div className="dashboard-micro-list">
            {shown.map((m) => {
              if (DATA_BACKED_FIELDS.has(m.fieldKey)) {
                const consumed = sumFieldKey(logs, m.fieldKey, Date.now(), supplements);
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
      case 'water':
        return (
          <HydrationTracker
            noCardShell
            logs={waterLogs.map((w) => ({ id: w.id, timestamp: w.timestamp, amount: w.milliliters }))}
            goals={{ ...goals, hydration: goals.hydration ?? goals.waterTarget ?? 2000 }}
            onAddWater={(ml) => onAddWater?.(ml)}
            onRemoveWater={(id) => onRemoveWater?.(id)}
          />
        );
      case 'supplements':
        return (
          <SupplementTracker
            embedded
            supplements={supplements}
            aiAccess={aiAccess ?? { provider: 'custom', customApiKey: '', cloudSignedIn: false }}
            onSave={(next) => onSaveSupplements?.(next)}
            onToggleTaken={(id) => onToggleSupplement?.(id)}
            onError={(msg) => onError?.(msg)}
            settingsOpen={settingsKey === 'supplements'}
            onSettingsOpenChange={(open) => { if (!open) setSettingsKey(null); }}
            onHidePanel={() => hidePanel('supplements')}
          />
        );
    }
  };

  const renderSettings = (key: PanelKey): React.ReactNode => {
    const common = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.85rem' }}>
        <button type="button" onClick={() => hidePanel(key)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <EyeOff size={14} /> Hide this panel
        </button>
      </div>
    );
    const iconBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-muted)', cursor: 'pointer' };

    if (key === 'calorieHalo') {
      const setCal = (cal: number) => { const g = updateNutrientGoals(cal, draftGoals); setDraftGoals(g); onSaveGoals?.(g); };
      return (
        <>
          {numInput('Base calorie target', draftGoals.calories, (n) => setDraftGoals(updateNutrientGoals(n, draftGoals)), 'kcal')}
          <button type="button" onClick={applyGoals} className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>Apply</button>
          <div style={{ marginTop: '0.85rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Quick goal</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              {([['Lose', 0.85], ['Maintain', 1], ['Gain', 1.15]] as const).map(([lbl, f]) => (
                <button key={lbl} type="button" onClick={() => setCal(Math.round(((Number(goals.calories) || 2000) * f) / 10) * 10)} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.7rem' }}>{lbl}</button>
              ))}
            </div>
          </div>
          {toggle('Show meal breakdown (B/L/D/S)', appSettings.showMealBreakdown !== false, (v) => patchSettings({ showMealBreakdown: v }))}
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
      const setMacroVisible = (k: MacroGoalKey, v: boolean) => {
        patchSettings({ visibleMacros: { ...appSettings.visibleMacros, [k]: v } });
      };
      const macroGoal = (k: MacroGoalKey) => {
        const row = MACRO_TRACKING_ROWS.find((r) => r.goalKey === k)!;
        return draftGoals[k] ?? row.defaultGoal;
      };
      const setMacroGoal = (k: MacroGoalKey, n: number) => {
        setDraftGoals({ ...draftGoals, [k]: n });
      };
      return (
        <>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Set targets and choose which macros appear on the dashboard.</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.5rem 0 0.65rem' }}>
            {MACRO_PRESETS.map((pr) => (
              <button key={pr.label} type="button" onClick={() => applyPreset(pr.p, pr.c, pr.f)} className="btn btn-secondary" style={{ fontSize: '0.74rem', padding: '0.35rem 0.6rem' }}>{pr.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {MACRO_TRACKING_ROWS.map((row) => (
              <div key={row.goalKey} style={SETTINGS_CARD}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {showCheckbox(macroVisible(row.visibleKey), (v) => setMacroVisible(row.visibleKey, v), `Show ${row.name}`)}
                  <span style={{ fontSize: '0.95rem', lineHeight: 1 }} aria-hidden>{row.emoji}</span>
                  <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  {limitTargetToggle(macroIsLimitMode(row.goalKey), (v) => setMacroIsLimit(row.goalKey, v), `${row.name} limit or target`)}
                  <input
                    type="number"
                    className="panel-settings-input"
                    value={macroGoal(row.goalKey)}
                    onChange={(e) => setMacroGoal(row.goalKey, Math.max(0, Number(e.target.value) || 0))}
                    aria-label={`${row.name} daily ${macroIsLimitMode(row.goalKey) ? 'limit' : 'target'}`}
                    style={{ width: '78px' }}
                    disabled={!macroVisible(row.visibleKey)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={applyGoals} className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>Apply targets</button>
          {common}
        </>
      );
    }
    if (key === 'micros') {
      return (
        <>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Track any micronutrient — edit limit, emoji, colour, reorder, or hide.</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
            {customMicros.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>No micros yet — add one below.</p>}
            {customMicros.map((m, idx) => (
              <div key={m.id} style={SETTINGS_CARD}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {showCheckbox(!m.hidden, (v) => updateMicro(m.id, { hidden: v ? undefined : true }), `Show ${m.name}`)}
                  <input
                    value={m.emoji}
                    maxLength={2}
                    onChange={(e) => updateMicro(m.id, { emoji: e.target.value })}
                    aria-label={`${m.name} emoji`}
                    className="panel-settings-input"
                    style={{ width: '36px', textAlign: 'center', padding: '0.35rem' }}
                  />
                  <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</span>
                  <button type="button" onClick={() => moveMicro(m.id, -1)} disabled={idx === 0} aria-label={`Move ${m.name} up`} style={{ ...iconBtn, opacity: idx === 0 ? 0.4 : 1 }}><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => moveMicro(m.id, 1)} disabled={idx === customMicros.length - 1} aria-label={`Move ${m.name} down`} style={{ ...iconBtn, opacity: idx === customMicros.length - 1 ? 0.4 : 1 }}><ArrowDown size={14} /></button>
                  <MicroColorButton
                    color={m.color}
                    iconBtnStyle={iconBtn}
                    onPick={(color, glowColor) => updateMicro(m.id, { color, glowColor })}
                  />
                  <button type="button" onClick={() => removeMicro(m.id)} aria-label={`Remove ${m.name}`} style={iconBtn}><Trash2 size={14} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  {limitTargetToggle(m.isLimit, (v) => updateMicro(m.id, { isLimit: v }), `${m.name} limit or target`)}
                  <input
                    type="number"
                    className="panel-settings-input"
                    value={m.dailyLimit}
                    onChange={(e) => updateMicro(m.id, { dailyLimit: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label={`${m.name} daily ${m.isLimit ? 'limit' : 'target'}`}
                    style={{ width: '78px' }}
                    disabled={!!m.hidden}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              value={newMicroName}
              onChange={(e) => setNewMicroName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addMicro(); } }}
              placeholder={isAiReady(aiAccess ?? { provider: 'custom', customApiKey: '', cloudSignedIn: false }) ? 'Add micro — AI fills details (e.g. Potassium)' : 'Add micro (e.g. Iron)'}
              aria-label="New micronutrient name"
              disabled={fetchingMicro}
              className="panel-settings-input"
              style={{ flex: 1 }}
            />
            <button type="button" onClick={() => void addMicro()} disabled={fetchingMicro || !newMicroName.trim()} className="btn btn-primary" aria-label="Add micronutrient" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', opacity: fetchingMicro || !newMicroName.trim() ? 0.6 : 1 }}>
              {isAiReady(aiAccess ?? { provider: 'custom', customApiKey: '', cloudSignedIn: false }) ? <Sparkles size={14} /> : <Plus size={14} />}{fetchingMicro ? '…' : 'Add'}
            </button>
          </div>
          {common}
        </>
      );
    }
    if (key === 'water') {
      const hydrationTarget = draftGoals.hydration ?? draftGoals.waterTarget ?? 2000;
      const setHydration = (ml: number) => setDraftGoals({ ...draftGoals, hydration: ml, waterTarget: ml });
      return (
        <>
          {numInput('Daily hydration target', hydrationTarget, setHydration, 'ml')}
          <button type="button" onClick={applyGoals} className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>Apply</button>
          {common}
        </>
      );
    }
    return <>{common}</>;
  };

  const visibleOrder = panelOrder.filter((k) => (appSettings.visibleWidgets as Record<string, boolean | undefined>)[k] !== false) as PanelKey[];
  const heroPanels = HERO_PANEL_KEYS.filter((k) => visibleOrder.includes(k));
  const secondaryPanels = SECONDARY_PANEL_KEYS.filter((k) => visibleOrder.includes(k));

  const renderPanelCard = (key: PanelKey, panelIndex: number, draggable: boolean) => {
    const meta = PANEL_META[key];
    const isCollapsed = !!collapsed[key];
    const isDragged = draggable && draggedKey === key;
    return (
      <div
        key={key}
        data-panel-key={key}
        tabIndex={0}
        aria-label={`${meta.title} panel.${draggable ? ' Hold and drag to reorder, or use arrow keys when focused.' : ''}`}
        className={`glass-card dashboard-panel motion-stagger${isCollapsed ? ' is-collapsed' : ''}${isDragged ? ' is-dragging' : ''}${key === 'calorieHalo' || key === 'water' ? ' dashboard-panel--compact' : ''}`}
        style={{
          '--i': panelIndex,
          position: 'relative',
          opacity: isDragged ? 0.5 : 1,
          transform: isDragged ? 'scale(0.97)' : 'none',
          border: isDragged ? '1px solid var(--accent-purple)' : undefined,
          boxShadow: isDragged ? '0 12px 40px var(--accent-purple-glow)' : undefined,
          transition: 'opacity 0.15s, transform 0.15s',
          cursor: draggable ? undefined : 'default',
        } as React.CSSProperties}
        onPointerDown={draggable ? handlePointerDown(key) : undefined}
        onPointerMove={draggable ? handlePointerMove : undefined}
        onPointerUp={draggable ? endDrag : undefined}
        onPointerCancel={draggable ? endDrag : undefined}
        onKeyDown={draggable ? (e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); movePanelByKey(key, -1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); movePanelByKey(key, 1); }
        } : undefined}
      >
        <div className="dashboard-panel-header">
          <button
            type="button"
            onClick={() => {
              if (draggable && consumeWasDragged()) return;
              toggleCollapse(key);
            }}
            aria-expanded={!isCollapsed}
            className="dashboard-panel-title-btn"
          >
            {meta.icon}
            {meta.title}
          </button>
          <button type="button" data-no-drag onClick={() => setSettingsKey(key)} aria-label={`${meta.title} settings`} className="dashboard-panel-icon-btn">
            <SlidersHorizontal size={15} />
          </button>
          <button type="button" data-no-drag onClick={() => toggleCollapse(key)} aria-label={isCollapsed ? `Expand ${meta.title}` : `Collapse ${meta.title}`} className="dashboard-panel-icon-btn">
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
        <div className={`panel-collapse-wrapper ${!isCollapsed ? 'expanded' : ''}`}>
          <div className="panel-collapse-content dashboard-panel-body">
            {renderBody(key)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-page">

      {voiceSlot ? <div className="dashboard-voice-slot">{voiceSlot}</div> : null}
      {mealPresetsSlot ? <div className="dashboard-presets-slot">{mealPresetsSlot}</div> : null}

      {heroPanels.length > 0 && (
        <div className="dashboard-hero-grid">
          {heroPanels.map((key, i) => renderPanelCard(key, i, false))}
        </div>
      )}

      <div className="dashboard-today-strip glass-card" aria-label="Today's meals">
        <div className="dashboard-today-strip-main">
          <span className="dashboard-today-strip-kicker">Today</span>
          <span className="dashboard-today-strip-count">
            <strong>{todayLogs.length}</strong>
            {todayLogs.length === 1 ? ' meal' : ' meals'}
          </span>
        </div>
        {appSettings.showMealBreakdown !== false && (
          <div className="dashboard-today-strip-slots" aria-label="Meals by slot">
            <span className={breakfastCount > 0 ? 'is-active' : ''} title="Breakfast">🍳 {breakfastCount}</span>
            <span className={lunchCount > 0 ? 'is-active' : ''} title="Lunch">🍱 {lunchCount}</span>
            <span className={dinnerCount > 0 ? 'is-active' : ''} title="Dinner">🥗 {dinnerCount}</span>
            <span className={snackCount > 0 ? 'is-active' : ''} title="Snacks">🍪 {snackCount}</span>
          </div>
        )}
      </div>

      {secondaryPanels.length > 0 && (
        <div className="dashboard-panel-grid">
          {secondaryPanels.map((key, panelIndex) => renderPanelCard(key, panelIndex + heroPanels.length, true))}
        </div>
      )}

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
      {settingsKey && settingsKey !== 'supplements' && createPortal(
        <div className="modal-overlay panel-settings-overlay" role="dialog" aria-modal="true" aria-label={`${PANEL_META[settingsKey as PanelKey].title} settings`} onClick={() => setSettingsKey(null)}>
          <div ref={drawerRef} className="panel-settings-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" aria-hidden />
            <div className="panel-settings-drawer-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                {PANEL_META[settingsKey as PanelKey].icon}
                {PANEL_META[settingsKey as PanelKey].title} settings
              </h3>
              <button type="button" onClick={() => setSettingsKey(null)} aria-label="Close" className="btn-icon panel-settings-close">
                <X size={16} />
              </button>
            </div>
            <div className="panel-settings-drawer-body">
              {renderSettings(settingsKey as PanelKey)}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
export default Dashboard;
