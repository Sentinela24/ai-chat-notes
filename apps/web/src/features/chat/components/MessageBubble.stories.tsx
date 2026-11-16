import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/Button';
import { SAMPLE_REPLY, useFakeStream } from '@/stories/useFakeStream';
import type { Message } from '../types';
import { MessageBubble } from './MessageBubble';

const assistant: Message = {
  id: 'a1',
  role: 'assistant',
  content: SAMPLE_REPLY,
  status: 'done',
  stopReason: 'end_turn',
  model: 'claude-opus-5-5',
  createdAt: 0,
};

const meta = {
  title: 'Chat/MessageBubble',
  component: MessageBubble,
  args: {
    message: assistant,
    onRetry: fn(),
    onSaveToNote: fn(),
    canRetry: true,
    showRegenerate: true,
  },
} satisfies Meta<typeof MessageBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Done: Story = {};

export const UserMessage: Story = {
  args: {
    message: {
      id: 'u1',
      role: 'user',
      content: 'Why is SSE a good fit for streaming LLM replies?',
      status: 'done',
      createdAt: 0,
    },
  },
};

export const WaitingForFirstToken: Story = {
  args: { message: { ...assistant, content: '', status: 'streaming' } },
};

export const Streaming: Story = {
  args: { message: { ...assistant, content: SAMPLE_REPLY.slice(0, 180), status: 'streaming' } },
};

/** Replays a reply token by token, like the real app. */
export const LiveStreaming: Story = {
  render: function Render(args) {
    const [runId, setRunId] = useState(0);
    const { text, done } = useFakeStream(SAMPLE_REPLY, { runId });
    return (
      <div className="flex flex-col gap-4">
        <MessageBubble
          {...args}
          message={{ ...assistant, content: text, status: done ? 'done' : 'streaming' }}
        />
        <div>
          <Button size="sm" onClick={() => setRunId((r) => r + 1)}>
            Replay
          </Button>
        </div>
      </div>
    );
  },
};

export const Stopped: Story = {
  args: { message: { ...assistant, content: SAMPLE_REPLY.slice(0, 220), status: 'stopped' } },
};

export const StoppedBeforeAnyText: Story = {
  args: { message: { ...assistant, content: '', status: 'stopped' } },
};

export const ErrorMidStream: Story = {
  args: {
    message: {
      ...assistant,
      content: SAMPLE_REPLY.slice(0, 120),
      status: 'error',
      error: {
        code: 'upstream',
        message: 'The connection to the model dropped. Please retry.',
        retryable: true,
      },
    },
  },
};

export const NonRetryableError: Story = {
  args: {
    message: {
      ...assistant,
      content: '',
      status: 'error',
      error: {
        code: 'auth',
        message: "Anthropic rejected the server's API key. Check the key in apps/server/.env.",
        retryable: false,
      },
    },
  },
};

export const Refusal: Story = {
  args: {
    message: {
      ...assistant,
      content: "I can't help with that request.",
      stopReason: 'refusal',
    },
  },
};

export const HitLengthLimit: Story = {
  args: { message: { ...assistant, stopReason: 'max_tokens' } },
};
