// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MealTemplateBar } from './MealTemplateBar';
import type { MealTemplate } from '../types/nutrition';

afterEach(cleanup);

const tmpl = (over: Partial<MealTemplate>): MealTemplate => ({
  id: Math.random().toString(36).slice(2),
  name: 'Preset',
  items: [{ name: 'A', quantity: '1', calories: 100, protein: 5, carbs: 10, fat: 2, confidence: 'high' }],
  createdAt: 1,
  ...over,
});

describe('MealTemplateBar', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<MealTemplateBar templates={[]} onApply={() => {}} onDelete={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the template name and total calories', () => {
    const t = tmpl({
      name: 'Breakfast',
      items: [
        { name: 'Egg', quantity: '1', calories: 78, protein: 6, carbs: 1, fat: 5, confidence: 'high' },
        { name: 'Toast', quantity: '1', calories: 80, protein: 3, carbs: 14, fat: 1, confidence: 'high' },
      ],
    });
    render(<MealTemplateBar templates={[t]} onApply={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('Breakfast')).toBeTruthy();
    expect(screen.getByText(/158 kcal/)).toBeTruthy();
    expect(screen.getByText(/2 items/)).toBeTruthy();
  });

  it('applies a preset on tap and deletes via its x', () => {
    const onApply = vi.fn();
    const onDelete = vi.fn();
    const t = tmpl({ name: 'Lunch' });
    render(<MealTemplateBar templates={[t]} onApply={onApply} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log preset Lunch' }));
    expect(onApply).toHaveBeenCalledWith(t);
    fireEvent.click(screen.getByRole('button', { name: 'Delete preset Lunch' }));
    expect(onDelete).toHaveBeenCalledWith(t.id);
  });
});
