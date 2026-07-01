export type MacroGoalKey = 'protein' | 'carbs' | 'fat' | 'saturatedFat' | 'transFat';

export const MACRO_CALORIES_PER_GRAM: Record<MacroGoalKey, number> = {
  protein: 4,
  carbs: 4,
  fat: 9,
  saturatedFat: 9,
  transFat: 9,
};

export const MACRO_TRACKING_ROWS: {
  goalKey: MacroGoalKey;
  visibleKey: MacroGoalKey;
  name: string;
  emoji: string;
  unit: string;
  defaultGoal: number;
  defaultIsLimit: boolean;
  color: string;
  glowColor: string;
  chartFill: string;
}[] = [
  {
    goalKey: 'protein',
    visibleKey: 'protein',
    name: 'Protein',
    emoji: '🍗',
    unit: 'g',
    defaultGoal: 150,
    defaultIsLimit: false,
    color: 'var(--accent-teal)',
    glowColor: 'var(--accent-teal-glow)',
    chartFill: 'rgba(20, 184, 166, 0.55)',
  },
  {
    goalKey: 'carbs',
    visibleKey: 'carbs',
    name: 'Carbohydrates',
    emoji: '🌾',
    unit: 'g',
    defaultGoal: 250,
    defaultIsLimit: false,
    color: 'var(--accent-blue)',
    glowColor: 'var(--accent-blue-glow)',
    chartFill: 'rgba(6, 182, 212, 0.55)',
  },
  {
    goalKey: 'fat',
    visibleKey: 'fat',
    name: 'Fats',
    emoji: '🥑',
    unit: 'g',
    defaultGoal: 65,
    defaultIsLimit: false,
    color: 'var(--accent-amber)',
    glowColor: 'var(--accent-amber-glow)',
    chartFill: 'rgba(245, 158, 11, 0.55)',
  },
  {
    goalKey: 'saturatedFat',
    visibleKey: 'saturatedFat',
    name: 'Saturated fat',
    emoji: '🧈',
    unit: 'g',
    defaultGoal: 20,
    defaultIsLimit: true,
    color: 'var(--accent-rose)',
    glowColor: 'var(--accent-rose-glow)',
    chartFill: 'rgba(244, 63, 94, 0.5)',
  },
  {
    goalKey: 'transFat',
    visibleKey: 'transFat',
    name: 'Trans fat',
    emoji: '⚠️',
    unit: 'g',
    defaultGoal: 2,
    defaultIsLimit: true,
    color: 'var(--accent-rose)',
    glowColor: 'var(--accent-rose-glow)',
    chartFill: 'rgba(225, 29, 72, 0.45)',
  },
];

/** All macro tracks visible — dashboard panel max body height is sized for this count. */
export const MACRO_PANEL_MAX_TRACK_COUNT = MACRO_TRACKING_ROWS.length;

export function resolveCssColor(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^rgba?\(/i.test(color)) return color;
  if (typeof document === 'undefined') {
    const fallback: Record<string, string> = {
      'var(--accent-teal)': '#14b8a6',
      'var(--accent-blue)': '#06b6d4',
      'var(--accent-amber)': '#f59e0b',
      'var(--accent-rose)': '#f43f5e',
      'var(--accent-purple)': '#8b5cf6',
      'var(--bg-secondary)': '#131520',
    };
    return fallback[color] ?? '#8b5cf6';
  }
  const probe = document.createElement('span');
  probe.style.color = color;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const parts = rgb.match(/\d+/g);
  if (!parts || parts.length < 3) return '#8b5cf6';
  return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
}
