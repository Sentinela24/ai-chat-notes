import { readSSE, StreamEventSchema, type StreamEvent } from '@acn/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { createMockProvider } from './providers/mock';
import type { LLMProvider, ProviderEvent } from './providers/types';

const app = createApp({ provider: createMockProvider({ delayMs: 0 }) });

function post(path: string, body: unknown, init: RequestInit = {}) {
  return app.request(`/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });
}

/** Reads the response exactly like the browser does: SSE parser + schema validation. */
async function readEvents(res: Response): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const msg of readSSE(res.body!)) {
    const event = StreamEventSchema.parse(JSON.parse(msg.data));
    expect(msg.event).toBe(event.type);
    events.push(event);
  }
  return events;
}

const textOf = (events: StreamEvent[]) =>
  events.flatMap((e) => (e.type === 'delta' ? [e.text] : [])).join('');

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('GET /api/config', () => {
  it('reports the active provider', async () => {
    const res = await app.request('/api/config');
    expect(await res.json()).toEqual({ provider: 'mock', model: 'mock-1', mock: true });
  });
});

describe('POST /api/chat', () => {
  it('streams start, deltas and done as SSE', async () => {
    const res = await post('/chat', { messages: [{ role: 'user', content: 'Hello' }] });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/event-stream/);

    const events = await readEvents(res);
    expect(events[0]).toMatchObject({ type: 'start', provider: 'mock', model: 'mock-1' });
    expect(events.at(-1)).toMatchObject({ type: 'done', stopReason: 'end_turn' });
    expect(textOf(events)).toContain('reply to: "Hello"');
  });

  it('rejects an invalid body with a 400 JSON error before streaming', async () => {
    const res = await post('/chat', { messages: [] });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'bad_request' } });
  });

  it('rejects malformed JSON', async () => {
    const res = await post('/chat', '{nope');
    expect(res.status).toBe(400);
  });

  it('requires the last message to come from the user', async () => {
    const res = await post('/chat', {
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
    });
    expect(res.status).toBe(400);
  });

  it('reports mid-stream failures as an in-band error event', async () => {
    const res = await post('/chat', { messages: [{ role: 'user', content: '/error' }] });
    expect(res.status).toBe(200);
    const events = await readEvents(res);
    expect(events.some((e) => e.type === 'delta')).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'upstream', retryable: true });
  });

  it('never forwards unknown error details to the client', async () => {
    const leaky: LLMProvider = {
      name: 'mock',
      model: 'leaky',
      // eslint-disable-next-line require-yield
      async *stream() {
        throw new Error('secret internal detail sk-123');
      },
    };
    const res = await createApp({ provider: leaky }).request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    const events = await readEvents(res);
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'unknown' });
    expect(JSON.stringify(events)).not.toContain('sk-123');
  });

  it('aborts the provider when the client disconnects', async () => {
    let providerSignal: AbortSignal | undefined;
    const slow: LLMProvider = {
      name: 'mock',
      model: 'slow',
      async *stream(_params, signal): AsyncGenerator<ProviderEvent> {
        providerSignal = signal;
        for (let i = 0; i < 1000; i++) {
          await new Promise((r) => setTimeout(r, 5));
          if (signal.aborted) return;
          yield { type: 'delta', text: 'x' };
        }
      },
    };
    const res = await createApp({ provider: slow }).request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    // Read a couple of events, then hang up like a browser pressing Stop.
    const reader = res.body!.getReader();
    await reader.read();
    await reader.read();
    await reader.cancel();

    await expect.poll(() => providerSignal?.aborted).toBe(true);
  });
});

describe('POST /api/transform', () => {
  it('streams a summary of the passage', async () => {
    const res = await post('/transform', {
      action: 'summarise',
      text: 'Notes about streaming UIs.',
    });
    const events = await readEvents(res);
    expect(textOf(events)).toMatch(/^\*\*Summary \(mock\):\*\* Notes about streaming UIs\./);
  });

  it('rejects unknown actions', async () => {
    const res = await post('/transform', { action: 'translate', text: 'hi' });
    expect(res.status).toBe(400);
  });
});
