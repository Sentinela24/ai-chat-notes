import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../types';
import { MessageBubble } from './MessageBubble';

const base: Message = {
  id: 'm1',
  role: 'assistant',
  content: 'Hello **world**',
  status: 'done',
  createdAt: 0,
  stopReason: 'end_turn',
};

describe('MessageBubble', () => {
  it('renders assistant Markdown', () => {
    render(<MessageBubble message={base} />);
    expect(screen.getByText('world').tagName).toBe('STRONG');
  });

  it('renders user messages as plain text', () => {
    render(<MessageBubble message={{ ...base, role: 'user', content: '**not bold**' }} />);
    expect(screen.getByText('**not bold**')).toBeInTheDocument();
  });

  it('marks a streaming reply as busy and hides actions', () => {
    render(<MessageBubble message={{ ...base, status: 'streaming' }} onRetry={vi.fn()} />);
    expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the error and a Retry button that calls onRetry', async () => {
    const onRetry = vi.fn();
    render(
      <MessageBubble
        message={{
          ...base,
          status: 'error',
          error: { code: 'upstream', message: 'Connection dropped', retryable: true },
        }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('Connection dropped')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledWith('m1');
  });

  it('does not offer Retry for non-retryable errors', () => {
    render(
      <MessageBubble
        message={{
          ...base,
          status: 'error',
          error: { code: 'bad_request', message: 'Too long', retryable: false },
        }}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('explains refusals', () => {
    render(<MessageBubble message={{ ...base, stopReason: 'refusal' }} />);
    expect(screen.getByText(/declined to answer/)).toBeInTheDocument();
  });

  it('offers Save to notes when a handler is given', async () => {
    const onSave = vi.fn();
    render(<MessageBubble message={base} onSaveToNote={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save to notes' }));
    expect(onSave).toHaveBeenCalledWith(base);
  });
});
