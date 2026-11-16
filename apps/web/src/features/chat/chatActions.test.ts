import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { delta, done, hangingSSEResponse, sseResponse, start } from '@/test/sse';
import { retryMessage, sendMessage, stopStreaming, toApiHistory } from './chatActions';
import { useChatStore } from './store';

const state = () => useChatStore.getState();

beforeEach(() => state().clear());
afterEach(() => vi.unstubAllGlobals());

describe('sendMessage', () => {
  it('adds the user message and streams the assistant reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(sseResponse([start, delta('Hello '), delta('there'), done])),
    );

    await sendMessage('  Hi  ');

    const [user, assistant] = state().messages;
    expect(user).toMatchObject({ role: 'user', content: 'Hi', status: 'done' });
    expect(assistant).toMatchObject({
      role: 'assistant',
      content: 'Hello there',
      status: 'done',
      model: 'mock-1',
      stopReason: 'end_turn',
    });
    expect(state().streamingId).toBeNull();
  });

  it('ignores blank input', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await sendMessage('   ');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state().messages).toEqual([]);
  });

  it('marks the reply as failed on an in-band error, keeping partial text', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            start,
            delta('Partial'),
            { type: 'error', code: 'upstream', message: 'Dropped', retryable: true },
          ]),
        ),
    );
    await sendMessage('Hi');
    expect(state().messages[1]).toMatchObject({
      status: 'error',
      content: 'Partial',
      error: { code: 'upstream', message: 'Dropped', retryable: true },
    });
  });

  it('treats a stream that ends without done as a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([start, delta('Cut')])));
    await sendMessage('Hi');
    expect(state().messages[1]).toMatchObject({ status: 'error', error: { code: 'network' } });
  });

  it('can be stopped, keeping the partial reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) =>
        Promise.resolve(hangingSSEResponse([start, delta('Some text')], init.signal!)),
      ),
    );

    const pending = sendMessage('Hi');
    await vi.waitFor(() => expect(state().messages[1]?.content).toBe('Some text'));
    expect(state().streamingId).not.toBeNull();

    stopStreaming();
    await pending;

    expect(state().messages[1]).toMatchObject({ status: 'stopped', content: 'Some text' });
    expect(state().streamingId).toBeNull();
  });
});

describe('retryMessage', () => {
  it('replaces a failed reply with a new one, sending the history before it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          start,
          { type: 'error', code: 'overloaded', message: 'Busy', retryable: true },
        ]),
      )
      .mockResolvedValueOnce(sseResponse([start, delta('Second try'), done]));
    vi.stubGlobal('fetch', fetchMock);

    await sendMessage('Hi');
    const failed = state().messages[1]!;
    await retryMessage(failed.id);

    expect(state().messages).toHaveLength(2);
    expect(state().messages[1]).toMatchObject({ content: 'Second try', status: 'done' });
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({
      messages: [{ role: 'user', content: 'Hi' }],
    });
  });
});

describe('toApiHistory', () => {
  it('drops failed and empty messages', () => {
    expect(
      toApiHistory([
        { id: '1', role: 'user', content: 'a', status: 'done', createdAt: 0 },
        { id: '2', role: 'assistant', content: 'x', status: 'error', createdAt: 0 },
        { id: '3', role: 'assistant', content: '', status: 'stopped', createdAt: 0 },
        { id: '4', role: 'user', content: 'b', status: 'done', createdAt: 0 },
        { id: '5', role: 'assistant', content: 'part', status: 'stopped', createdAt: 0 },
      ]),
    ).toEqual([
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'part' },
    ]);
  });
});
