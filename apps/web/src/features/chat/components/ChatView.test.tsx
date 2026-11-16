import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { delta, done, hangingSSEResponse, sseResponse, start } from '@/test/sse';
import { useChatStore } from '../store';
import { ChatView } from './ChatView';

beforeEach(() => useChatStore.getState().clear());
afterEach(() => vi.unstubAllGlobals());

const liveRegion = () => document.querySelector('[aria-live="polite"]')!;

describe('ChatView', () => {
  it('streams a reply and announces it in sentences, then completion', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([start, delta('Hello **there**. '), delta('Second part'), done]),
        ),
    );
    render(<ChatView />);
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Hi{Enter}');

    await waitFor(() =>
      expect(screen.getByRole('article', { name: 'Assistant replied' })).toHaveAttribute(
        'aria-busy',
        'false',
      ),
    );
    expect(screen.getByText('there').tagName).toBe('STRONG');
    await waitFor(() => expect(liveRegion()).toHaveTextContent(/Response complete\.$/));
    // Markdown syntax is stripped from what gets read aloud.
    expect(liveRegion().textContent).not.toContain('*');
  });

  it('stops on Escape, announces it, and returns focus to the composer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init: RequestInit) =>
        Promise.resolve(hangingSSEResponse([start, delta('Partial answer')], init.signal!)),
      ),
    );
    render(<ChatView />);
    const user = userEvent.setup();
    const input = screen.getByRole('textbox', { name: 'Message' });

    await user.type(input, 'Hi{Enter}');
    await screen.findByRole('button', { name: 'Stop generating' });
    expect(liveRegion()).toHaveTextContent('Assistant is responding.');

    // Focus the Stop button, which will disappear when the stream ends.
    screen.getByRole('button', { name: 'Stop generating' }).focus();
    await user.keyboard('{Escape}');

    await screen.findByText(/Stopped/);
    expect(useChatStore.getState().messages[1]).toMatchObject({
      status: 'stopped',
      content: 'Partial answer',
    });
    await waitFor(() => expect(input).toHaveFocus());
    expect(liveRegion()).toHaveTextContent('Response stopped.');
  });
});
