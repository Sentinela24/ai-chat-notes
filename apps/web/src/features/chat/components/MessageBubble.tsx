import { clsx } from 'clsx';
import { AlertTriangle, Check, Copy, NotebookPen, RotateCcw, Square } from 'lucide-react';
import { forwardRef, memo, useEffect, useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Markdown } from '@/components/ui/Markdown';
import type { Message } from '../types';

export interface MessageBubbleProps {
  message: Message;
  /** Regenerate this reply. Shown for failed/stopped replies, and for the latest reply. */
  onRetry?: (id: string) => void;
  /** Save this reply into a note. */
  onSaveToNote?: (message: Message) => void;
  /** Whether Retry/Regenerate is available (e.g. not while another reply is streaming). */
  canRetry?: boolean;
  /** Show "Regenerate" on a successful reply (only for the latest one). */
  showRegenerate?: boolean;
}

/**
 * One chat message. Purely presentational: everything it shows comes from
 * `message`, and every action is a callback, so it's easy to render in
 * Storybook in each state (streaming, done, stopped, error, refusal).
 */
export const MessageBubble = memo(
  forwardRef<HTMLButtonElement, MessageBubbleProps>(function MessageBubble(
    { message, onRetry, onSaveToNote, canRetry = true, showRegenerate = false },
    retryRef,
  ) {
    const { role, content, status, error, stopReason } = message;
    const isUser = role === 'user';
    const streaming = status === 'streaming';
    const refused = status === 'done' && stopReason === 'refusal';
    const truncated = status === 'done' && stopReason === 'max_tokens';
    const finished = status !== 'streaming';

    if (isUser) {
      return (
        <article aria-label="You said" className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 whitespace-pre-wrap text-accent-fg">
            {content}
          </div>
        </article>
      );
    }

    const retryLabel = status === 'done' ? 'Regenerate' : 'Retry';
    const showRetry =
      onRetry &&
      ((status === 'error' && error?.retryable !== false) ||
        status === 'stopped' ||
        (status === 'done' && showRegenerate));

    return (
      <article
        aria-label="Assistant replied"
        aria-busy={streaming}
        data-status={status}
        className="group flex flex-col gap-2"
      >
        {content ? (
          <Markdown className={clsx(streaming && 'streaming-caret')}>{content}</Markdown>
        ) : streaming ? (
          <ThinkingDots />
        ) : null}

        {status === 'stopped' && (
          <StatusNote icon={<Square className="size-3.5" aria-hidden />}>
            Stopped{content ? '' : ' before any text arrived'}.
          </StatusNote>
        )}
        {refused && (
          <StatusNote icon={<AlertTriangle className="size-3.5" aria-hidden />}>
            The model declined to answer this request.
          </StatusNote>
        )}
        {truncated && (
          <StatusNote icon={<AlertTriangle className="size-3.5" aria-hidden />}>
            The reply hit the length limit and was cut off.
          </StatusNote>
        )}

        {status === 'error' && error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{error.message}</p>
          </div>
        )}

        {finished && (
          <div className="flex items-center gap-1 text-muted">
            {showRetry && (
              <Button
                ref={retryRef}
                variant={status === 'error' ? 'danger' : 'ghost'}
                size="sm"
                icon={<RotateCcw className="size-3.5" aria-hidden />}
                disabled={!canRetry}
                onClick={() => onRetry(message.id)}
              >
                {retryLabel}
              </Button>
            )}
            {content && <CopyButton text={content} />}
            {content && onSaveToNote && (
              <IconButton
                label="Save to notes"
                icon={<NotebookPen className="size-4" aria-hidden />}
                onClick={() => onSaveToNote(message)}
              />
            )}
            {message.model && (
              <span className="ml-auto text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {message.model}
              </span>
            )}
          </div>
        )}
      </article>
    );
  }),
);

function StatusNote({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      {icon}
      {children}
    </p>
  );
}

function ThinkingDots() {
  return (
    <div className="flex h-6 items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted motion-safe:animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <IconButton
      label={copied ? 'Copied' : 'Copy reply'}
      icon={
        copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />
      }
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => setCopied(true));
      }}
    />
  );
}
