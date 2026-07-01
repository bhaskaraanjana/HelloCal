// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Analytics } from './Analytics';
import type { AppSettings, MealLog, UserGoals } from '../types/nutrition';

vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart" />,
  Doughnut: () => <div data-testid="doughnut-chart" />,
  Line: () => <div data-testid="line-chart" />,
}));

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  registerables: [],
}));

afterEach(cleanup);

const goals: UserGoals = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
  hydration: 2000,
};

const appSettings: AppSettings = {
  theme: 'obsidian',
  visibleMacros: { protein: true, carbs: true, fat: true, saturatedFat: false, transFat: false },
  visibleMicros: { addedSugar: false, fiber: false, sodium: false },
  customMicros: [],
  visibleWidgets: {
    calorieHalo: true,
    macros: true,
    micros: true,
    workouts: false,
    mealSlots: true,
    goalCompletion: true,
    water: true,
    streak: true,
    supplements: true,
  },
};

describe('Analytics', () => {
  it('renders overview with stat strip and calories chart', () => {
    render(<Analytics logs={[]} goals={goals} appSettings={appSettings} />);
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeTruthy();
    expect(screen.getByText('Avg calories')).toBeTruthy();
    expect(screen.getByText('On target')).toBeTruthy();
    expect(screen.getByText('Hydration')).toBeTruthy();
    expect(screen.getByText(/Calories vs goal/i)).toBeTruthy();
    expect(screen.getByText(/Daily adherence/i)).toBeTruthy();
    expect(screen.getAllByTestId('bar-chart').length).toBeGreaterThan(0);
  });

  it('switches to details view for micronutrients', () => {
    render(<Analytics logs={[]} goals={goals} appSettings={appSettings} />);
    fireEvent.click(screen.getByRole('tab', { name: /Details/i }));
    expect(screen.getByRole('heading', { name: 'Micronutrients' })).toBeTruthy();
  });

  it('toggles compare prior control', () => {
    render(<Analytics logs={[]} goals={goals} appSettings={appSettings} />);
    const btn = screen.getByRole('button', { name: /vs prior period/i });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onNavigateToDay from heatmap cell click', () => {
    const onNavigateToDay = vi.fn();
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    const logs: MealLog[] = [
      {
        id: '1',
        timestamp: day.getTime(),
        mealType: 'lunch',
        items: [
          {
            id: 'f',
            name: 'Meal',
            quantity: '1',
            calories: 2000,
            protein: 150,
            carbs: 100,
            fat: 50,
            confidence: 'high',
          },
        ],
      },
    ];
    render(
      <Analytics
        logs={logs}
        goals={goals}
        appSettings={appSettings}
        onNavigateToDay={onNavigateToDay}
      />
    );
    const cells = document.querySelectorAll('.analytics-heatmap-cell');
    expect(cells.length).toBeGreaterThan(0);
    fireEvent.click(cells[cells.length - 1]);
    expect(onNavigateToDay).toHaveBeenCalled();
  });
});
