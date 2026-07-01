// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { VoiceInput } from './VoiceInput';
import type { AiAccess } from '../services/aiRuntime';

afterEach(cleanup);

const baseProps = {
  personality: 'encouraging' as const,
  onParsingSuccess: vi.fn(),
  onError: vi.fn(),
};

const noAi: AiAccess = { provider: 'custom', customApiKey: '', cloudSignedIn: false };
const withKey: AiAccess = { provider: 'custom', customApiKey: 'some-key', cloudSignedIn: false };

describe('VoiceInput', () => {
  it('discloses the key requirement when there is no API key', () => {
    const onOpenSettings = vi.fn();
    render(<VoiceInput {...baseProps} aiAccess={noAi} onOpenSettings={onOpenSettings} />);

    expect(screen.getByText(/need a Gemini key/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add key/i }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('logs typed text offline (no key) via the local parser', async () => {
    const onParsingSuccess = vi.fn();
    render(<VoiceInput {...baseProps} aiAccess={noAi} onParsingSuccess={onParsingSuccess} />);

    const input = screen.getByPlaceholderText(/type what you ate/i);
    fireEvent.change(input, { target: { value: 'banana' } });
    fireEvent.click(screen.getByRole('button', { name: /Log typed entry/i }));

    await Promise.resolve();
    expect(onParsingSuccess).toHaveBeenCalled();
    const arg = onParsingSuccess.mock.calls[0][0];
    expect(arg.type).toBe('food');
    expect(Array.isArray(arg.items)).toBe(true);
  });

  it('does not disclose the key hint when AI is ready', () => {
    render(<VoiceInput {...baseProps} aiAccess={withKey} />);
    expect(screen.queryByText(/need a Gemini key/i)).toBeNull();
  });
});
