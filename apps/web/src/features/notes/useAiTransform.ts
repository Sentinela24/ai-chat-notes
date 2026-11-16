import type { ErrorCode, StopReason, TransformAction } from '@acn/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { streamEvents, toDisplayError } from '@/lib/api/streamEvents';
import { createFrameBuffer } from '@/lib/stream/frameBuffer';

export interface TextRange {
  from: number;
  to: number;
}

export type TransformStatus = 'streaming' | 'done' | 'stopped' | 'error';

export type TransformState =
  | { status: 'idle' }
  | {
      status: TransformStatus;
      action: TransformAction;
      /** The selected text that was sent. */
      source: string;
      /** Where the selection was in the document, so the result can replace it. */
      range: TextRange;
      /** The streamed result (Markdown). */
      text: string;
      stopReason?: StopReason;
      error?: { code: ErrorCode; message: string; retryable: boolean };
    };

/**
 * Streams a summarise/rewrite of a passage into local state.
 *
 * Unlike chat, the result is a *suggestion*: it streams into a preview and is
 * only written into the document when the user accepts it, as a single
 * editor transaction (so one Undo reverts it). Unmounting cancels the request.
 */
export function useAiTransform() {
  const [state, setState] = useState<TransformState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(
    async (action: TransformAction, selection: TextRange & { text: string }) => {
      controllerRef.current?.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;

      const { from, to, text: source } = selection;
      setState({ status: 'streaming', action, source, range: { from, to }, text: '' });

      // Every update is guarded on `idle`: if the user discarded the preview, late chunks are dropped.
      const update = (fn: (s: Exclude<TransformState, { status: 'idle' }>) => TransformState) =>
        setState((s) => (s.status === 'idle' ? s : fn(s)));
      const buffer = createFrameBuffer((chunk) => update((s) => ({ ...s, text: s.text + chunk })));

      try {
        for await (const event of streamEvents(
          '/api/transform',
          { action, text: source },
          ctrl.signal,
        )) {
          if (event.type === 'delta') buffer.push(event.text);
          else if (event.type === 'done') {
            buffer.flush();
            update((s) => ({ ...s, status: 'done', stopReason: event.stopReason }));
            return;
          } else if (event.type === 'error') {
            buffer.flush();
            const { code, message, retryable } = event;
            update((s) => ({ ...s, status: 'error', error: { code, message, retryable } }));
            return;
          }
        }
        buffer.flush();
        update((s) => ({
          ...s,
          status: 'error',
          error: {
            code: 'network',
            message: 'The connection closed before the suggestion finished.',
            retryable: true,
          },
        }));
      } catch (err) {
        buffer.flush();
        if (ctrl.signal.aborted) update((s) => ({ ...s, status: 'stopped' }));
        else update((s) => ({ ...s, status: 'error', error: toDisplayError(err) }));
      } finally {
        buffer.cancel();
        if (controllerRef.current === ctrl) controllerRef.current = null;
      }
    },
    [],
  );

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState({ status: 'idle' });
  }, []);

  return { state, start, stop, reset };
}
