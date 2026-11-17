import { AlertTriangle, ArrowDownToLine, Check, RotateCcw, Square, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Markdown } from '@/components/ui/Markdown';
import type { TransformState } from '../useAiTransform';

export interface AiPreviewPanelProps {
  state: Exclude<TransformState, { status: 'idle' }>;
  onStop: () => void;
  onReplace: () => void;
  onInsertBelow: () => void;
  onDiscard: () => void;
  onRetry: () => void;
}

const VERB = { summarise: 'Summarising', rewrite: 'Rewriting' } as const;

// The explicit `string` return type makes the switch exhaustive: a new status
// without a case fails to compile instead of rendering an empty status region.
function getStatusText({
  status,
  action,
  error,
  stopReason,
}: AiPreviewPanelProps['state']): string {
  switch (status) {
    case 'streaming':
      return `${VERB[action]} selection…`;
    case 'error':
      return `Suggestion failed: ${error?.message ?? 'unknown error'}`;
    case 'stopped':
      return 'Stopped. You can still use the partial suggestion.';
    case 'done':
      return stopReason === 'refusal'
        ? 'The model declined to transform this passage.'
        : 'Suggestion ready. Replace the selection, insert it below, or discard it.';
  }
}

/**
 * Shows a streamed AI suggestion before it touches the document.
 *
 * Focus management: when the stream starts, focus moves to Stop (the editor is
 * read-only meanwhile); when it finishes, focus moves to the primary action,
 * so a keyboard user can accept with Enter or dismiss with Escape.
 */
export function AiPreviewPanel({
  state,
  onStop,
  onReplace,
  onInsertBelow,
  onDiscard,
  onRetry,
}: AiPreviewPanelProps) {
  const { status, action, text, error, stopReason } = state;
  const stopRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const refused = stopReason === 'refusal';
  const hasResult = text.trim().length > 0 && !refused;

  useEffect(() => {
    if (status === 'streaming') stopRef.current?.focus();
    else if (status === 'error') (retryRef.current ?? primaryRef.current)?.focus();
    else primaryRef.current?.focus();
  }, [status]);

  const statusText = getStatusText(state);

  return (
    <section
      aria-label="AI suggestion"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (status === 'streaming') onStop();
          else onDiscard();
        }
      }}
      className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-surface-2 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {action === 'summarise' ? 'Summary' : 'Rewrite'} suggestion
        </h3>
        <p role="status" className="text-xs text-muted">
          {statusText}
        </p>
      </div>

      <div
        aria-busy={status === 'streaming'}
        className="max-h-72 overflow-y-auto rounded-lg bg-surface p-3"
      >
        {text ? (
          <Markdown className={status === 'streaming' ? 'streaming-caret' : undefined}>
            {text}
          </Markdown>
        ) : status === 'streaming' ? (
          <p className="text-sm text-muted">Waiting for the first words…</p>
        ) : (
          <p className="text-sm text-muted">No text was generated.</p>
        )}
      </div>

      {status === 'error' && error && (
        <p className="flex items-start gap-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === 'streaming' ? (
          <Button
            ref={stopRef}
            size="sm"
            icon={<Square className="size-3.5 fill-current" aria-hidden />}
            onClick={onStop}
          >
            Stop
          </Button>
        ) : (
          <>
            {hasResult && (
              <>
                <Button
                  ref={primaryRef}
                  size="sm"
                  variant="primary"
                  icon={<Check className="size-4" aria-hidden />}
                  onClick={action === 'rewrite' ? onReplace : onInsertBelow}
                >
                  {action === 'rewrite' ? 'Replace selection' : 'Insert below'}
                </Button>
                <Button
                  size="sm"
                  icon={<ArrowDownToLine className="size-4" aria-hidden />}
                  onClick={action === 'rewrite' ? onInsertBelow : onReplace}
                >
                  {action === 'rewrite' ? 'Insert below' : 'Replace selection'}
                </Button>
              </>
            )}
            {(status === 'error' ? error?.retryable !== false : true) && (
              <Button
                ref={status === 'error' ? retryRef : undefined}
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="size-3.5" aria-hidden />}
                onClick={onRetry}
              >
                {status === 'error' ? 'Retry' : 'Try again'}
              </Button>
            )}
            <Button
              ref={hasResult ? undefined : primaryRef}
              size="sm"
              variant="ghost"
              icon={<X className="size-4" aria-hidden />}
              onClick={onDiscard}
            >
              Discard
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
