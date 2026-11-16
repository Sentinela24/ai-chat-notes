type Schedule = (cb: () => void) => number;
type Cancel = (handle: number) => void;

const defaultSchedule: Schedule =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, 16) as unknown as number;
const defaultCancel: Cancel =
  typeof cancelAnimationFrame === 'function'
    ? (h) => cancelAnimationFrame(h)
    : (h) => clearTimeout(h);

export interface FrameBuffer {
  push(text: string): void;
  /** Write out anything pending right now (e.g. on `done`). */
  flush(): void;
  /** Drop the scheduled flush without writing. */
  cancel(): void;
}

/**
 * Coalesces many small text chunks into at most one state update per frame.
 *
 * A fast model can emit 50-100+ deltas a second. Writing each one to state
 * re-renders (and re-parses Markdown) for every token; batching to the display
 * refresh rate keeps the UI smooth with no visible difference. When the tab is
 * hidden, requestAnimationFrame pauses, so we do no rendering work at all and
 * catch up in one update when the user comes back.
 */
export function createFrameBuffer(
  onFlush: (text: string) => void,
  schedule: Schedule = defaultSchedule,
  cancelScheduled: Cancel = defaultCancel,
): FrameBuffer {
  let pending = '';
  let handle: number | null = null;

  const flush = () => {
    if (handle !== null) {
      cancelScheduled(handle);
      handle = null;
    }
    if (pending) {
      const text = pending;
      pending = '';
      onFlush(text);
    }
  };

  return {
    push(text) {
      pending += text;
      if (handle === null) {
        handle = schedule(() => {
          handle = null;
          flush();
        });
      }
    },
    flush,
    cancel() {
      if (handle !== null) cancelScheduled(handle);
      handle = null;
      pending = '';
    },
  };
}
