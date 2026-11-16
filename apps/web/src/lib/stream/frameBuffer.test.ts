import { describe, expect, it, vi } from 'vitest';
import { createFrameBuffer } from './frameBuffer';

function manualScheduler() {
  const callbacks = new Map<number, () => void>();
  let next = 1;
  return {
    schedule: (cb: () => void) => {
      callbacks.set(next, cb);
      return next++;
    },
    cancel: (h: number) => void callbacks.delete(h),
    tick: () => {
      const cbs = [...callbacks.values()];
      callbacks.clear();
      cbs.forEach((cb) => cb());
    },
    get size() {
      return callbacks.size;
    },
  };
}

describe('createFrameBuffer', () => {
  it('coalesces pushes within a frame into one flush', () => {
    const s = manualScheduler();
    const onFlush = vi.fn();
    const buf = createFrameBuffer(onFlush, s.schedule, s.cancel);

    buf.push('a');
    buf.push('b');
    buf.push('c');
    expect(onFlush).not.toHaveBeenCalled();
    expect(s.size).toBe(1);

    s.tick();
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith('abc');
  });

  it('flush() writes pending text immediately and cancels the scheduled frame', () => {
    const s = manualScheduler();
    const onFlush = vi.fn();
    const buf = createFrameBuffer(onFlush, s.schedule, s.cancel);

    buf.push('x');
    buf.flush();
    expect(onFlush).toHaveBeenCalledWith('x');
    expect(s.size).toBe(0);
    s.tick();
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('cancel() drops pending text', () => {
    const s = manualScheduler();
    const onFlush = vi.fn();
    const buf = createFrameBuffer(onFlush, s.schedule, s.cancel);

    buf.push('x');
    buf.cancel();
    s.tick();
    buf.flush();
    expect(onFlush).not.toHaveBeenCalled();
  });
});
