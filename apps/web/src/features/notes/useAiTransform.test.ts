import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { delta, done, hangingSSEResponse, sseResponse, start } from '@/test/sse';
import { useAiTransform } from './useAiTransform';

afterEach(() => vi.unstubAllGlobals());

const selection = { from: 1, to: 20, text: 'Some selected text' };

describe('useAiTransform', () => {
  it('streams a suggestion and remembers the range it applies to', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(sseResponse([start, delta('Short '), delta('version'), done]));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAiTransform());

    await act(() => result.current.start('summarise', selection));

    expect(result.current.state).toMatchObject({
      status: 'done',
      action: 'summarise',
      text: 'Short version',
      range: { from: 1, to: 20 },
      source: 'Some selected text',
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      action: 'summarise',
      text: 'Some selected text',
    });
  });

  it('can be stopped, keeping the partial suggestion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init: RequestInit) =>
        Promise.resolve(hangingSSEResponse([start, delta('Partial')], init.signal!)),
      ),
    );
    const { result } = renderHook(() => useAiTransform());

    let pending: Promise<void>;
    act(() => {
      pending = result.current.start('rewrite', selection);
    });
    await waitFor(() => expect(result.current.state).toMatchObject({ text: 'Partial' }));

    await act(async () => {
      result.current.stop();
      await pending;
    });
    expect(result.current.state).toMatchObject({ status: 'stopped', text: 'Partial' });
  });

  it('reset() discards the suggestion and ignores late chunks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init: RequestInit) =>
        Promise.resolve(hangingSSEResponse([start, delta('x')], init.signal!)),
      ),
    );
    const { result } = renderHook(() => useAiTransform());
    let pending: Promise<void>;
    act(() => {
      pending = result.current.start('rewrite', selection);
    });
    await waitFor(() => expect(result.current.state.status).toBe('streaming'));

    await act(async () => {
      result.current.reset();
      await pending;
    });
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('surfaces errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            start,
            { type: 'error', code: 'overloaded', message: 'Busy', retryable: true },
          ]),
        ),
    );
    const { result } = renderHook(() => useAiTransform());
    await act(() => result.current.start('rewrite', selection));
    expect(result.current.state).toMatchObject({
      status: 'error',
      error: { code: 'overloaded', retryable: true },
    });
  });

  it('aborts the request on unmount', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init: RequestInit) => {
        signal = init.signal!;
        return Promise.resolve(hangingSSEResponse([start], init.signal!));
      }),
    );
    const { result, unmount } = renderHook(() => useAiTransform());
    act(() => void result.current.start('rewrite', selection));
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal!.aborted).toBe(true);
  });
});
