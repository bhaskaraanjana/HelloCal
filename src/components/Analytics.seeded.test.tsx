// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Analytics } from './Analytics';
import { buildAnalyticsSeed } from '../services/analyticsSeed';
import { resolveAnalyticsWindow } from '../services/analyticsRange';
import { computeDailyTotals } from '../services/dailyTotals';
import type { AppSettings } from '../types/nutrition';

vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart" />,
  Doughnut: () => <div data-testid="doughnut-chart" />,
  Line: () => <div data-testid="line-chart" />,
}));

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  registerables: [],
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const REF = new Date(2026, 5, 15, 12, 0, 0).getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(REF);
});

const seed = () => buildAnalyticsSeed();

const appSettings: AppSettings = {
  theme: 'obsidian',
  visibleMacros: { protein: true, carbs: true, fat: true, saturatedFat: false, transFat: false },
  visibleMicros: { addedSugar: true, fiber: true, sodium: true },
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

describe('Analytics with seeded data', () => {
  it('shows populated KPIs and insights from seed data', () => {
    const data = seed();
    render(
      <Analytics
        logs={data.logs}
        goals={data.goals}
        appSettings={appSettings}
        waterLogs={data.waterLogs}
        supplements={data.supplements}
      />
    );
    const window = resolveAnalyticsWindow(data.logs, 7);
    const avg = Math.round(
      window.days.reduce(
        (sum, d) => sum + computeDailyTotals(data.logs, [], d.getTime()).consumedCalories,
        0
      ) / window.dayCount
    );
    expect(avg).toBeGreaterThan(1500);
    expect(screen.getByText(`${avg} kcal/day`)).toBeTruthy();
    expect(screen.getByText('Hydration')).toBeTruthy();
    expect(screen.getByText('On target')).toBeTruthy();
    expect(document.querySelector('.analytics-insights')).toBeTruthy();
    const cells = document.querySelectorAll('.analytics-heatmap-cell');
    expect(cells.length).toBeGreaterThan(0);
    const logged = [...cells].filter((c) => !c.classList.contains('analytics-heatmap-cell--0'));
    expect(logged.length).toBeGreaterThan(0);
  });

  it('drill-down fires onNavigateToDay from heatmap', () => {
    const data = seed();
    const onNavigateToDay = vi.fn();
    render(
      <Analytics
        logs={data.logs}
        goals={data.goals}
        appSettings={appSettings}
        waterLogs={data.waterLogs}
        supplements={data.supplements}
        onNavigateToDay={onNavigateToDay}
      />
    );
    const active = document.querySelector(
      '.analytics-heatmap-cell--1, .analytics-heatmap-cell--2, .analytics-heatmap-cell--3'
    );
    expect(active).toBeTruthy();
    fireEvent.click(active!);
    expect(onNavigateToDay).toHaveBeenCalledWith(expect.any(Number));
  });
});
