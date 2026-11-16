import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AiPreviewPanel } from './AiPreviewPanel';

const base = {
  action: 'rewrite' as const,
  source: 'streaming is when the server send data bit by bit and the ui show it as it comes',
  range: { from: 1, to: 80 },
  text: 'Streaming means the server sends data incrementally, and the UI renders each piece as it arrives.',
};

const meta = {
  title: 'Notes/AiPreviewPanel',
  component: AiPreviewPanel,
  args: {
    state: { ...base, status: 'done' },
    onStop: fn(),
    onReplace: fn(),
    onInsertBelow: fn(),
    onDiscard: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof AiPreviewPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RewriteReady: Story = {};

export const Streaming: Story = {
  args: { state: { ...base, status: 'streaming', text: base.text.slice(0, 40) } },
};

export const SummaryReady: Story = {
  args: {
    state: {
      ...base,
      action: 'summarise',
      status: 'done',
      text: '**Summary:** the server streams data and the UI renders it incrementally.',
    },
  },
};

export const Failed: Story = {
  args: {
    state: {
      ...base,
      status: 'error',
      text: '',
      error: {
        code: 'overloaded',
        message: 'The model is overloaded. Please retry.',
        retryable: true,
      },
    },
  },
};
