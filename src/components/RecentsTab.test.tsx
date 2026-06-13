// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RecentsTab } from './RecentsTab';
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

describe('RecentsTab', () => {
  it('shows an empty state with no favorites', () => {
    render(<RecentsTab favorites={[]} onQuickLog={() => {}} onTogglePin={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/No foods yet/i)).toBeTruthy();
  });

  it('lists foods and filters by the search query', () => {
    const favs = [fav({ name: 'Banana' }), fav({ name: 'Chicken Breast' })];
    render(<RecentsTab favorites={favs} onQuickLog={() => {}} onTogglePin={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('Banana')).toBeTruthy();
    expect(screen.getByText('Chicken Breast')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search your foods'), { target: { value: 'chick' } });
    expect(screen.queryByText('Banana')).toBeNull();
    expect(screen.getByText('Chicken Breast')).toBeTruthy();
  });

  it('shows a no-match message for an unmatched query', () => {
    render(<RecentsTab favorites={[fav({ name: 'Banana' })]} onQuickLog={() => {}} onTogglePin={() => {}} onDelete={() => {}} />);
    fireEvent.change(screen.getByLabelText('Search your foods'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No foods match/i)).toBeTruthy();
  });

  it('wires log / pin / delete actions', () => {
    const onQuickLog = vi.fn();
    const onTogglePin = vi.fn();
    const onDelete = vi.fn();
    const banana = fav({ name: 'Banana' });
    render(<RecentsTab favorites={[banana]} onQuickLog={onQuickLog} onTogglePin={onTogglePin} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log Banana' }));
    expect(onQuickLog).toHaveBeenCalledWith(banana);
    fireEvent.click(screen.getByRole('button', { name: 'Pin Banana' }));
    expect(onTogglePin).toHaveBeenCalledWith(banana.id);
    fireEvent.click(screen.getByRole('button', { name: /Remove Banana/ }));
    expect(onDelete).toHaveBeenCalledWith(banana.id);
  });
});
