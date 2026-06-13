// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ProgressBar from './ui/ProgressBar';
import { EmptyState } from './ui/EmptyState';
import { StreakBadge } from './StreakBadge';
import { WaterTracker } from './WaterTracker';

afterEach(cleanup);

describe('ProgressBar', () => {
  it('shows the value/max label', () => {
    render(<ProgressBar label="Protein" value={50} max={100} color="#000" glowColor="#000" />);
    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText(/50g/)).toBeTruthy();
    expect(screen.getByText(/100g/)).toBeTruthy();
  });

  it('renders an over-budget warning only when value exceeds max', () => {
    const { rerender } = render(<ProgressBar label="Sugar" value={80} max={100} color="#000" glowColor="#000" />);
    expect(screen.queryByText(/Over budget/)).toBeNull();
    rerender(<ProgressBar label="Sugar" value={150} max={100} color="#000" glowColor="#000" />);
    expect(screen.getByText(/Over budget by 50%/)).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('renders the title and subtitle', () => {
    render(<EmptyState title="No foods yet" subtitle="Log your first meal" />);
    expect(screen.getByText('No foods yet')).toBeTruthy();
    expect(screen.getByText('Log your first meal')).toBeTruthy();
  });
});

describe('StreakBadge', () => {
  it('renders the current streak count', () => {
    render(<StreakBadge streak={5} totalDays={20} />);
    expect(screen.getByText('5')).toBeTruthy();
  });
});

describe('WaterTracker', () => {
  it('shows progress percent and logs a quick-add amount', () => {
    const onAdd = vi.fn();
    render(<WaterTracker todayMl={1250} targetMl={2500} onAdd={onAdd} onUndo={() => {}} />);
    expect(screen.getByText(/50%/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 250 ml of water' }));
    expect(onAdd).toHaveBeenCalledWith(250);
  });
});
