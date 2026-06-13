// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuickLogBar } from './QuickLogBar';
import type { FavoriteFood } from '../types/nutrition';

afterEach(cleanup);

const fav = (over: Partial<FavoriteFood>): FavoriteFood => ({
  id: Math.random().toString(36).slice(2),
  name: 'Food',
  quantity: '1',
  calories: 100,
  protein: 1,
  carbs: 1,
  fat: 1,
  frequency: 1,
  lastLogged: 0,
  ...over,
});

describe('QuickLogBar', () => {
  it('renders nothing when there are no favorites', () => {
    const { container } = render(<QuickLogBar favorites={[]} onQuickLog={() => {}} onTogglePin={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a chip per favorite with its calories', () => {
    render(<QuickLogBar favorites={[fav({ name: 'Banana', calories: 105 })]} onQuickLog={() => {}} onTogglePin={() => {}} />);
    expect(screen.getByText('Banana')).toBeTruthy();
    expect(screen.getByText(/105 kcal/)).toBeTruthy();
  });

  it('caps the carousel at 8 chips', () => {
    const favs = Array.from({ length: 12 }, (_, i) => fav({ name: `F${i}`, frequency: 12 - i }));
    render(<QuickLogBar favorites={favs} onQuickLog={() => {}} onTogglePin={() => {}} />);
    const logButtons = screen.getAllByRole('button', { name: /^Quick log / });
    expect(logButtons).toHaveLength(8);
  });

  it('sorts pinned favorites first', () => {
    const favs = [
      fav({ name: 'Unpinned', frequency: 99 }),
      fav({ name: 'Pinned', frequency: 1, pinned: true }),
    ];
    render(<QuickLogBar favorites={favs} onQuickLog={() => {}} onTogglePin={() => {}} />);
    const buttons = screen.getAllByRole('button', { name: /^Quick log / });
    expect(buttons[0].getAttribute('aria-label')).toBe('Quick log Pinned');
  });

  it('invokes onQuickLog with the favorite when its chip is tapped', () => {
    const onQuickLog = vi.fn();
    const banana = fav({ name: 'Banana' });
    render(<QuickLogBar favorites={[banana]} onQuickLog={onQuickLog} onTogglePin={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quick log Banana' }));
    expect(onQuickLog).toHaveBeenCalledWith(banana);
  });
});
