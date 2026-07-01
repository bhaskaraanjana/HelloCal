// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import type { AppSettings, MealLog, UserGoals } from '../types/nutrition';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const goals: UserGoals = { calories: 2000, protein: 130, carbs: 220, fat: 65, addedSugar: 30, fiber: 30, sodium: 2300, waterTarget: 2500 };
const settings: AppSettings = {
  theme: 'obsidian',
  visibleMacros: { protein: true, carbs: true, fat: true },
  visibleMicros: { addedSugar: true, fiber: true, sodium: true },
  visibleWidgets: { calorieHalo: true, macros: true, micros: true, workouts: false, mealSlots: true, goalCompletion: true, water: true, streak: true, supplements: true },
  customMicros: [
    { id: 'micro_addedsugar', name: 'Added Sugar', emoji: '🍭', unit: 'g', dailyLimit: 30, isLimit: true, color: 'var(--accent-purple)', glowColor: 'var(--accent-purple-glow)', fieldKey: 'addedSugar' },
    { id: 'micro_fiber', name: 'Dietary Fiber', emoji: '🌿', unit: 'g', dailyLimit: 30, isLimit: false, color: 'var(--accent-teal)', glowColor: 'var(--accent-teal-glow)', fieldKey: 'fiber' },
  ],
};
const todayMeal = (): MealLog => ({
  id: 'm1',
  timestamp: Date.now(),
  mealType: 'lunch',
  items: [{ id: 'i1', name: 'Soup', quantity: '1 bowl', calories: 300, protein: 10, carbs: 30, fat: 8, confidence: 'high' }],
});

describe('Dashboard', () => {
  it('shows the first-log quick-start nudge when nothing is logged today', () => {
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} />);
    expect(screen.getByText(/Quick start/i)).toBeTruthy();
  });

  it('hides the nudge once a meal is logged today', () => {
    render(<Dashboard logs={[todayMeal()]} workouts={[]} goals={goals} appSettings={settings} />);
    expect(screen.queryByText(/Quick start/i)).toBeNull();
  });

  it('renders all five dashboard panels', () => {
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} />);
    expect(screen.getByLabelText(/Today's Calories panel/i)).toBeTruthy();
    expect(screen.getByLabelText(/Macronutrients panel/i)).toBeTruthy();
    expect(screen.getByLabelText(/Micronutrients panel/i)).toBeTruthy();
    expect(screen.getByLabelText(/Water Tracker panel/i)).toBeTruthy();
    expect(screen.getByLabelText(/Supplements panel/i)).toBeTruthy();
  });

  it('self-heals a stale saved panel order so no panel is dropped', () => {
    localStorage.setItem('hellocal_dashboard_order', JSON.stringify(['macros', 'ghostPanel', 'workouts', 'mealSlots', 'goalCompletion']));
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} />);
    // Hero panels (calories, water) are pinned; macros/micros/supplements remain draggable.
    expect(screen.getAllByLabelText(/panel\. Hold and drag to reorder/i)).toHaveLength(3);
  });

  it('shows a compact today meals strip', () => {
    render(<Dashboard logs={[todayMeal()]} workouts={[]} goals={goals} appSettings={settings} />);
    const strip = screen.getByLabelText("Today's meals");
    expect(strip).toBeTruthy();
    expect(strip.textContent).toMatch(/1\s*meal/i);
  });

  it('collapsing a panel persists to localStorage', () => {
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Macronutrients' }));
    expect(localStorage.getItem('hellocal_dashboard_collapsed') || '').toContain('macros');
  });

  it('opens a per-panel settings drawer and applies goal changes', () => {
    const onSaveGoals = vi.fn();
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onSaveGoals={onSaveGoals} />);
    fireEvent.click(screen.getByRole('button', { name: "Today's Calories settings" }));
    expect(screen.getByRole('dialog', { name: /Today's Calories settings/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSaveGoals).toHaveBeenCalled();
  });

  it('offers to restore a hidden panel', () => {
    const onSaveAppSettings = vi.fn();
    const s: AppSettings = { ...settings, visibleWidgets: { ...settings.visibleWidgets, macros: false } };
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={s} onSaveAppSettings={onSaveAppSettings} />);
    const restore = screen.getByRole('button', { name: 'Restore Macronutrients panel' });
    fireEvent.click(restore);
    expect(onSaveAppSettings).toHaveBeenCalled();
    expect(onSaveAppSettings.mock.calls.at(-1)![0].visibleWidgets.macros).toBe(true);
  });

  it('renders custom micros, summing data-backed values from logged food', () => {
    const meal: MealLog = { id: 'm', timestamp: Date.now(), mealType: 'lunch', items: [{ id: 'i', name: 'Cereal', quantity: '1', calories: 200, protein: 4, carbs: 40, fat: 2, addedSugar: 12, fiber: 5, confidence: 'high' }] };
    render(<Dashboard logs={[meal]} workouts={[]} goals={goals} appSettings={settings} />);
    expect(screen.getByText(/Added Sugar/)).toBeTruthy();
    expect(screen.getByText(/Dietary Fiber/)).toBeTruthy();
  });

  it('shows progress bar for a custom micro even with no logged data (since all micros are dynamically auto-tracked)', () => {
    const s: AppSettings = { ...settings, customMicros: [{ id: 'mk', name: 'Selenium', emoji: '🔬', unit: 'mcg', dailyLimit: 55, isLimit: false, color: 'var(--accent-blue)', glowColor: 'var(--accent-blue-glow)', fieldKey: 'selenium' }] };
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={s} />);
    expect(screen.getByText(/Selenium/)).toBeTruthy();
    expect(screen.queryByText(/Not auto-tracked from foods/i)).toBeNull();
  });

  it('adds a custom micronutrient from the micros settings (offline, no key)', () => {
    const onSaveAppSettings = vi.fn();
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onSaveAppSettings={onSaveAppSettings} />);
    fireEvent.click(screen.getByRole('button', { name: 'Micronutrients settings' }));
    fireEvent.change(screen.getByLabelText('New micronutrient name'), { target: { value: 'Iron' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add micronutrient' }));
    expect(onSaveAppSettings).toHaveBeenCalled();
    const lastCall = onSaveAppSettings.mock.calls.at(-1)![0];
    expect(lastCall.customMicros.some((m: { fieldKey: string }) => m.fieldKey === 'iron')).toBe(true);
  });

  it('canonicalizes a multi-word backed micro to the camelCase FoodItem key', async () => {
    const onSaveAppSettings = vi.fn();
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onSaveAppSettings={onSaveAppSettings} />);
    fireEvent.click(screen.getByRole('button', { name: 'Micronutrients settings' }));
    fireEvent.change(screen.getByLabelText('New micronutrient name'), { target: { value: 'Added Sugar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add micronutrient' }));
    // addMicro is async (awaits the offline default). Wait for the save.
    await vi.waitFor(() => expect(onSaveAppSettings).toHaveBeenCalled());
    const added = onSaveAppSettings.mock.calls.at(-1)![0].customMicros.find((m: { name: string }) => m.name === 'Added Sugar');
    expect(added.fieldKey).toBe('addedSugar'); // not 'addedsugar'
    expect(added.unit).toBe('g');
  });

  it('auto-tracks a data-backed custom micro instead of showing "not auto-tracked"', () => {
    const meal: MealLog = { id: 'm', timestamp: Date.now(), mealType: 'lunch', items: [{ id: 'i', name: 'Cereal', quantity: '1', calories: 200, protein: 4, carbs: 40, fat: 2, addedSugar: 12, confidence: 'high' }] };
    const s: AppSettings = { ...settings, customMicros: [{ id: 'mk', name: 'Added Sugar', emoji: '🍭', unit: 'g', dailyLimit: 30, isLimit: true, color: 'var(--accent-purple)', glowColor: 'var(--accent-purple-glow)', fieldKey: 'addedSugar' }] };
    render(<Dashboard logs={[meal]} workouts={[]} goals={goals} appSettings={s} />);
    expect(screen.getByText(/Added Sugar/)).toBeTruthy();
    expect(screen.queryByText(/Not auto-tracked from foods/i)).toBeNull();
  });

  it('toggles macro limit vs target in macronutrients settings', () => {
    const onSaveAppSettings = vi.fn();
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onSaveAppSettings={onSaveAppSettings} />);
    fireEvent.click(screen.getByRole('button', { name: 'Macronutrients settings' }));
    fireEvent.click(screen.getByRole('group', { name: 'Protein limit or target' }).querySelector('button')!);
    expect(onSaveAppSettings).toHaveBeenCalled();
    expect(onSaveAppSettings.mock.calls.at(-1)![0].macroIsLimit?.protein).toBe(true);
  });

  it('closes the per-panel settings drawer on Escape', () => {
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onSaveGoals={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: "Today's Calories settings" }));
    expect(screen.getByRole('dialog', { name: /Today's Calories settings/i })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Today's Calories settings/i })).toBeNull();
  });

  it('reorders panels via arrow keys when a panel is focused (keyboard a11y)', () => {
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} />);
    const panel = screen.getByLabelText(/Today's Calories panel/i);
    fireEvent.keyDown(panel, { key: 'ArrowDown' });
    const order = JSON.parse(localStorage.getItem('hellocal_dashboard_order') || '[]');
    expect(order[0]).not.toBe('calorieHalo');
  });
});
