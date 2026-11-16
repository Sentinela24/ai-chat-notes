import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from './Composer';

function setup(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const onSend = vi.fn();
  const onStop = vi.fn();
  render(<Composer onSend={onSend} onStop={onStop} isStreaming={false} {...props} />);
  return { onSend, onStop, input: screen.getByRole('textbox', { name: 'Message' }) };
}

describe('Composer', () => {
  it('sends on Enter and clears the input', async () => {
    const { onSend, input } = setup();
    await userEvent.type(input, 'Hello{Enter}');
    expect(onSend).toHaveBeenCalledWith('Hello');
    expect(input).toHaveValue('');
  });

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const { onSend, input } = setup();
    await userEvent.type(input, 'a{Shift>}{Enter}{/Shift}b');
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('a\nb');
  });

  it('does not send blank messages', async () => {
    const { onSend, input } = setup();
    await userEvent.type(input, '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('shows a Stop button while streaming and keeps the draft', async () => {
    const { onSend, onStop, input } = setup({ isStreaming: true });
    await userEvent.type(input, 'next question{Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('next question');

    await userEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
    expect(onStop).toHaveBeenCalled();
  });
});
