import { MessageSquarePlus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useChat } from '../useChat';
import type { Message } from '../types';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';
import { MessageList } from './MessageList';
import { StreamAnnouncer } from './StreamAnnouncer';

export interface ChatViewProps {
  onSaveToNote?: (message: Message) => void;
}

export function ChatView({ onSaveToNote }: ChatViewProps) {
  const { messages, isStreaming, send, stop, retry, clear } = useChat();
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const last = messages.at(-1);
  const contentKey = `${messages.length}:${last?.content.length ?? 0}:${last?.status}`;

  // Escape stops the reply from anywhere in the chat view.
  useEffect(() => {
    if (!isStreaming) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isStreaming, stop]);

  // Focus recovery: the Stop button disappears when streaming ends, and a Retry
  // button disappears when it's clicked. If focus was on either, it would fall
  // to <body>; send it back to the composer instead.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) composerRef.current?.focus();
  }, [isStreaming]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2
          id="view-heading"
          tabIndex={-1}
          className="text-sm font-medium text-muted focus:outline-none"
        >
          Chat
        </h2>
        <Button
          size="sm"
          variant="ghost"
          icon={<MessageSquarePlus className="size-4" aria-hidden />}
          disabled={isStreaming || messages.length === 0}
          onClick={() => {
            clear();
            composerRef.current?.focus();
          }}
        >
          New chat
        </Button>
      </div>

      <MessageList contentKey={contentKey}>
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <ol aria-label="Conversation" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
            {messages.map((m) => (
              <li key={m.id}>
                <MessageBubble
                  message={m}
                  onRetry={retry}
                  canRetry={!isStreaming}
                  showRegenerate={m === last}
                  onSaveToNote={onSaveToNote}
                />
              </li>
            ))}
          </ol>
        )}
      </MessageList>

      <StreamAnnouncer message={last} />

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <Composer ref={composerRef} onSend={send} onStop={stop} isStreaming={isStreaming} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-lg font-medium">Ask anything</p>
      <p className="text-sm text-muted">
        Replies stream in token by token. Press Esc or the stop button to cancel, and save any reply
        to your notes.
      </p>
    </div>
  );
}
