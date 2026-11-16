import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Composer } from './Composer';

const meta = {
  title: 'Chat/Composer',
  component: Composer,
  args: { onSend: fn(), onStop: fn(), isStreaming: false },
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithDraft: Story = {
  args: { defaultValue: 'Summarise the difference between SSE and WebSockets' },
};

export const MultiLineDraft: Story = {
  args: {
    defaultValue:
      'Compare these:\n1. Server-Sent Events\n2. WebSockets\n3. Long polling\n\nKeep it short.',
  },
};

/** While a reply streams, the button becomes Stop and Enter doesn't send. */
export const Streaming: Story = {
  args: { isStreaming: true, defaultValue: 'Drafting my next question…' },
};

/** Interaction test: Enter sends and clears; Shift+Enter adds a newline. */
export const SendsOnEnter: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Message' });
    await userEvent.type(input, 'Line one{Shift>}{Enter}{/Shift}line two');
    await expect(args.onSend).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onSend).toHaveBeenCalledWith('Line one\nline two');
    await expect(input).toHaveValue('');
  },
};
