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
  visibleWidgets: { calorieHalo: true, macros: true, micros: true, workouts: true, mealSlots: true, goalCompletion: true, water: true, streak: true },
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
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} />);
    expect(screen.getByText(/Quick start/i)).toBeTruthy();
  });

  it('hides the nudge once a meal is logged today', () => {
    render(<Dashboard logs={[todayMeal()]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} />);
    expect(screen.queryByText(/Quick start/i)).toBeNull();
  });

  it('renders all six panels with drag handles', () => {
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} />);
    expect(screen.getAllByRole('button', { name: /Drag .* panel/ })).toHaveLength(6);
  });

  it('self-heals a stale saved panel order so no panel is dropped', () => {
    // Stale order: missing several panels + contains a removed key.
    localStorage.setItem('hellocal_dashboard_order', JSON.stringify(['macros', 'ghostPanel']));
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} />);
    expect(screen.getAllByRole('button', { name: /Drag .* panel/ })).toHaveLength(6);
  });

  it('collapsing a panel persists to localStorage', () => {
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Macronutrients' }));
    expect(localStorage.getItem('hellocal_dashboard_collapsed') || '').toContain('macros');
  });

  it('opens a per-panel settings drawer and applies goal changes', () => {
    const onSaveGoals = vi.fn();
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} onSaveGoals={onSaveGoals} />);
    fireEvent.click(screen.getByRole('button', { name: 'Daily Halo settings' }));
    expect(screen.getByRole('dialog', { name: /Daily Halo settings/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSaveGoals).toHaveBeenCalled();
  });

  it('offers to restore a hidden panel', () => {
    const onSaveAppSettings = vi.fn();
    const s: AppSettings = { ...settings, visibleWidgets: { ...settings.visibleWidgets, macros: false } };
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={s} onTriggerCustomize={() => {}} onSaveAppSettings={onSaveAppSettings} />);
    const restore = screen.getByRole('button', { name: 'Restore Macronutrients panel' });
    fireEvent.click(restore);
    expect(onSaveAppSettings).toHaveBeenCalled();
    expect(onSaveAppSettings.mock.calls.at(-1)![0].visibleWidgets.macros).toBe(true);
  });

  it('renders custom micros, summing data-backed values from logged food', () => {
    const meal: MealLog = { id: 'm', timestamp: Date.now(), mealType: 'lunch', items: [{ id: 'i', name: 'Cereal', quantity: '1', calories: 200, protein: 4, carbs: 40, fat: 2, addedSugar: 12, fiber: 5, confidence: 'high' }] };
    render(<Dashboard logs={[meal]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} />);
    expect(screen.getByText(/Added Sugar/)).toBeTruthy();
    expect(screen.getByText(/Dietary Fiber/)).toBeTruthy();
  });

  it('shows progress bar for a custom micro even with no logged data (since all micros are dynamically auto-tracked)', () => {
    const s: AppSettings = { ...settings, customMicros: [{ id: 'mk', name: 'Selenium', emoji: '🔬', unit: 'mcg', dailyLimit: 55, isLimit: false, color: 'var(--accent-blue)', glowColor: 'var(--accent-blue-glow)', fieldKey: 'selenium' }] };
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={s} onTriggerCustomize={() => {}} />);
    expect(screen.getByText(/Selenium/)).toBeTruthy();
    expect(screen.queryByText(/Not auto-tracked from foods/i)).toBeNull();
  });

  it('adds a custom micronutrient from the micros settings (offline, no key)', () => {
    const onSaveAppSettings = vi.fn();
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} onSaveAppSettings={onSaveAppSettings} />);
    fireEvent.click(screen.getByRole('button', { name: 'Micronutrients settings' }));
    fireEvent.change(screen.getByLabelText('New micronutrient name'), { target: { value: 'Iron' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add micronutrient' }));
    expect(onSaveAppSettings).toHaveBeenCalled();
    const lastCall = onSaveAppSettings.mock.calls.at(-1)![0];
    expect(lastCall.customMicros.some((m: { fieldKey: string }) => m.fieldKey === 'iron')).toBe(true);
  });

  it('canonicalizes a multi-word backed micro to the camelCase FoodItem key', async () => {
    const onSaveAppSettings = vi.fn();
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} onSaveAppSettings={onSaveAppSettings} />);
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
    render(<Dashboard logs={[meal]} workouts={[]} goals={goals} appSettings={s} onTriggerCustomize={() => {}} />);
    expect(screen.getByText(/Added Sugar/)).toBeTruthy();
    expect(screen.queryByText(/Not auto-tracked from foods/i)).toBeNull();
  });

  it('closes the per-panel settings drawer on Escape', () => {
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} onSaveGoals={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Daily Halo settings' }));
    expect(screen.getByRole('dialog', { name: /Daily Halo settings/i })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Daily Halo settings/i })).toBeNull();
  });

  it('reorders panels via arrow keys on the grip (keyboard a11y)', () => {
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} />);
    const grip = screen.getByRole('button', { name: /Drag Daily Halo panel/ });
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    const order = JSON.parse(localStorage.getItem('hellocal_dashboard_order') || '[]');
    expect(order[0]).not.toBe('calorieHalo'); // Daily Halo moved down one slot
  });
});
