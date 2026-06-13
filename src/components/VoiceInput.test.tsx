// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { VoiceInput } from './VoiceInput';

afterEach(cleanup);

const baseProps = {
  personality: 'encouraging' as const,
  onParsingSuccess: vi.fn(),
  onError: vi.fn(),
};

describe('VoiceInput', () => {
  it('discloses the key requirement and offers search when there is no API key', () => {
    const onOpenSettings = vi.fn();
    const onOpenSearch = vi.fn();
    render(<VoiceInput {...baseProps} apiKey="" onOpenSettings={onOpenSettings} onOpenSearch={onOpenSearch} />);

    expect(screen.getByText(/need a free Gemini key/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add key/i }));
    expect(onOpenSettings).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Search the food database/i }));
    expect(onOpenSearch).toHaveBeenCalled();
  });

  it('logs typed text offline (no key) via the local parser', async () => {
    const onParsingSuccess = vi.fn();
    render(<VoiceInput {...baseProps} apiKey="" onParsingSuccess={onParsingSuccess} />);

    const input = screen.getByPlaceholderText(/type what you ate/i);
    fireEvent.change(input, { target: { value: 'banana' } });
    fireEvent.click(screen.getByRole('button', { name: /Log typed entry/i }));

    // localParser is synchronous; allow the click handler's microtask to settle.
    await Promise.resolve();
    expect(onParsingSuccess).toHaveBeenCalled();
    const arg = onParsingSuccess.mock.calls[0][0];
    expect(arg.type).toBe('food');
    expect(Array.isArray(arg.items)).toBe(true);
  });

  it('does not disclose the key hint when an API key is present', () => {
    render(<VoiceInput {...baseProps} apiKey="some-key" />);
    expect(screen.queryByText(/need a free Gemini key/i)).toBeNull();
  });
});
