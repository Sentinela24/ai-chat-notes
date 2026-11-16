import { MessageSquarePlus } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useChat } from '../useChat';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';
import { MessageList } from './MessageList';
import type { Message } from '../types';

export interface ChatViewProps {
  onSaveToNote?: (message: Message) => void;
}

export function ChatView({ onSaveToNote }: ChatViewProps) {
  const { messages, isStreaming, send, stop, retry, clear } = useChat();
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const last = messages.at(-1);
  const contentKey = `${messages.length}:${last?.content.length ?? 0}:${last?.status}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-medium text-muted">Chat</h2>
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
          <ol className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
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
