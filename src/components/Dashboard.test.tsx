// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import type { AppSettings, MealLog, UserGoals } from '../types/nutrition';

afterEach(cleanup);

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
});
