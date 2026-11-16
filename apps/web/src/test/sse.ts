import type { StreamEvent } from '@acn/shared';

/** Encodes events the way the server does, for faking `fetch` in tests. */
export function sseBody(events: StreamEvent[], { close = true } = {}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const e of events) {
        controller.enqueue(encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
      }
      if (close) controller.close();
    },
  });
}

export function sseResponse(events: StreamEvent[], opts?: { close?: boolean }): Response {
  return new Response(sseBody(events, opts), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

/** A response whose body stays open until the request's signal aborts (like a slow model). */
export function hangingSSEResponse(events: StreamEvent[], signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) {
        controller.enqueue(encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
      }
      signal.addEventListener('abort', () =>
        controller.error(new DOMException('The operation was aborted.', 'AbortError')),
      );
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

export const start: StreamEvent = { type: 'start', id: 'r1', provider: 'mock', model: 'mock-1' };
export const delta = (text: string): StreamEvent => ({ type: 'delta', text });
export const done: StreamEvent = { type: 'done', stopReason: 'end_turn' };
