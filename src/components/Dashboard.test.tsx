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
});
