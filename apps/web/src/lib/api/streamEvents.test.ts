import { afterEach, describe, expect, it, vi } from 'vitest';
import { delta, done, sseResponse, start } from '@/test/sse';
import { streamEvents, StreamRequestError } from './streamEvents';

afterEach(() => vi.unstubAllGlobals());

async function collect(gen: AsyncGenerator<unknown>) {
  const out = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe('streamEvents', () => {
  it('POSTs JSON and yields validated events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([start, delta('Hi'), done]));
    vi.stubGlobal('fetch', fetchMock);

    const events = await collect(streamEvents('/api/chat', { a: 1 }, new AbortController().signal));

    expect(events).toEqual([start, delta('Hi'), done]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/chat');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
  });

  it('skips malformed and unknown events instead of failing', async () => {
    const body = new ReadableStream({
      start(c) {
        const enc = new TextEncoder();
        c.enqueue(enc.encode('data: not json\n\n'));
        c.enqueue(enc.encode('data: {"type":"future_event"}\n\n'));
        c.enqueue(enc.encode(`data: ${JSON.stringify(delta('ok'))}\n\n`));
        c.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));

    const events = await collect(streamEvents('/x', {}, new AbortController().signal));
    expect(events).toEqual([delta('ok')]);
  });

  it('turns a 400 JSON error into a non-retryable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { code: 'bad_request', message: 'Too long' } }, { status: 400 }),
        ),
    );
    await expect(collect(streamEvents('/x', {}, new AbortController().signal))).rejects.toEqual(
      new StreamRequestError('bad_request', 'Too long', false),
    );
  });

  it('turns a 429 into a retryable rate-limit error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('busy', { status: 429 })));
    await expect(
      collect(streamEvents('/x', {}, new AbortController().signal)),
    ).rejects.toMatchObject({ code: 'rate_limited', retryable: true });
  });

  it('reports an unreachable server as a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(
      collect(streamEvents('/x', {}, new AbortController().signal)),
    ).rejects.toMatchObject({ code: 'network', retryable: true });
  });
});
