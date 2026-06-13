// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HydrationTracker } from './HydrationTracker';
import type { HydrationLog, UserGoals } from '../types/nutrition';

// canvas-confetti touches a real <canvas> that jsdom can't render — stub it.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

afterEach(cleanup);

const goals: UserGoals = {
  calories: 2000, protein: 130, carbs: 220, fat: 65,
  addedSugar: 30, fiber: 30, sodium: 2300, waterTarget: 2500, hydration: 2000,
};

const log = (over: Partial<HydrationLog>): HydrationLog => ({
  id: Math.random().toString(36).slice(2),
  timestamp: Date.now(),
  amount: 250,
  ...over,
});

describe('HydrationTracker', () => {
  it('renders the beaker at 0% with no logs', () => {
    render(<HydrationTracker logs={[]} goals={goals} onAddWater={() => {}} onRemoveWater={() => {}} />);
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByText(/0 \/ 2000 ml/)).toBeTruthy();
  });

  it('sums only today\'s logs (ignores stale ones) and clamps the fill at 100%', () => {
    const stale = log({ amount: 9999, timestamp: Date.now() - 3 * 24 * 3600 * 1000 });
    const todayA = log({ amount: 1000 });
    const todayB = log({ amount: 1500 }); // 2500 > 2000 target -> clamps to 100%
    render(<HydrationTracker logs={[stale, todayA, todayB]} goals={goals} onAddWater={() => {}} onRemoveWater={() => {}} />);
    expect(screen.getByText(/2500 \/ 2000 ml/)).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    // Goal-met pill appears once the target is reached.
    expect(screen.getByText(/DAILY HYDRATION HALO MET/i)).toBeTruthy();
  });

  it('quick-add buttons report the right amount', () => {
    const onAddWater = vi.fn();
    render(<HydrationTracker logs={[]} goals={goals} onAddWater={onAddWater} onRemoveWater={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '250ml' }));
    expect(onAddWater).toHaveBeenCalledWith(250);
    fireEvent.click(screen.getByRole('button', { name: '500ml' }));
    expect(onAddWater).toHaveBeenCalledWith(500);
  });

  it('removes the most recent log via the undo control', () => {
    const onRemoveWater = vi.fn();
    const first = log({ amount: 250 });
    const last = log({ amount: 500 });
    render(<HydrationTracker logs={[first, last]} goals={goals} onAddWater={() => {}} onRemoveWater={onRemoveWater} />);
    fireEvent.click(screen.getByTitle('Remove last log'));
    expect(onRemoveWater).toHaveBeenCalledWith(last.id);
  });

  it('logs a custom amount through the inline form', () => {
    const onAddWater = vi.fn();
    render(<HydrationTracker logs={[]} goals={goals} onAddWater={onAddWater} onRemoveWater={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Custom' }));
    const input = screen.getByDisplayValue('250');
    fireEvent.change(input, { target: { value: '333' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAddWater).toHaveBeenCalledWith(333);
  });

  it('falls back to a 2000ml default target when no hydration goal is set', () => {
    const { hydration, ...noHydration } = goals;
    void hydration;
    render(<HydrationTracker logs={[log({ amount: 500 })]} goals={noHydration as UserGoals} onAddWater={() => {}} onRemoveWater={() => {}} />);
    expect(screen.getByText(/500 \/ 2000 ml/)).toBeTruthy();
  });
});
