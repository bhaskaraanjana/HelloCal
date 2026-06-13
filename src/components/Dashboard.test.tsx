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

  it('renders custom micros, summing data-backed values from logged food', () => {
    const meal: MealLog = { id: 'm', timestamp: Date.now(), mealType: 'lunch', items: [{ id: 'i', name: 'Cereal', quantity: '1', calories: 200, protein: 4, carbs: 40, fat: 2, addedSugar: 12, fiber: 5, confidence: 'high' }] };
    render(<Dashboard logs={[meal]} workouts={[]} goals={goals} appSettings={settings} onTriggerCustomize={() => {}} />);
    expect(screen.getByText(/Added Sugar/)).toBeTruthy();
    expect(screen.getByText(/Dietary Fiber/)).toBeTruthy();
  });

  it('shows "not auto-tracked" for a custom micro with no logged data (honesty)', () => {
    const s: AppSettings = { ...settings, customMicros: [{ id: 'mk', name: 'Potassium', emoji: '🍌', unit: 'mg', dailyLimit: 3500, isLimit: false, color: 'var(--accent-blue)', glowColor: 'var(--accent-blue-glow)', fieldKey: 'potassium' }] };
    render(<Dashboard logs={[]} workouts={[]} goals={goals} appSettings={s} onTriggerCustomize={() => {}} />);
    expect(screen.getByText(/Potassium/)).toBeTruthy();
    expect(screen.getByText(/Not auto-tracked from foods/i)).toBeTruthy();
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
});
