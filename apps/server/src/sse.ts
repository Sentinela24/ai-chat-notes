import type { StreamEvent } from '@acn/shared';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { isAbortError, toErrorEvent } from './providers/errors';
import type { CompletionParams, LLMProvider } from './providers/types';

export const HEARTBEAT_MS = 15_000;

/**
 * Runs a provider stream and relays it to the browser as SSE.
 *
 * Wire format (one JSON payload per event, `event:` mirrors `type`):
 *
 *   event: start   data: {"type":"start","id":"...","provider":"mock","model":"mock-1"}
 *   event: delta   data: {"type":"delta","text":"Hello"}
 *   event: done    data: {"type":"done","stopReason":"end_turn","usage":{...}}
 *   event: error   data: {"type":"error","code":"overloaded","message":"...","retryable":true}
 *
 * Errors that happen after the 200 has been sent can't change the status
 * code, so they travel in-band as an `error` event.
 *
 * Cancellation: when the browser aborts its fetch, the TCP connection closes,
 * Hono fires `onAbort`, and we abort the provider call too, so we stop paying
 * for tokens nobody will read.
 */
export function streamCompletion(c: Context, provider: LLMProvider, params: CompletionParams) {
  // Ask reverse proxies (nginx etc.) not to buffer the stream.
  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    const upstream = new AbortController();
    const abort = () => {
      if (upstream.signal.aborted) return;
      console.info(`[${provider.name}] client disconnected, aborting upstream request`);
      upstream.abort();
    };
    stream.onAbort(abort);
    c.req.raw.signal.addEventListener('abort', abort, { once: true });

    const send = (event: StreamEvent) =>
      stream.writeSSE({ event: event.type, data: JSON.stringify(event) });

    // Comment lines keep idle connections from being closed by proxies while the model "thinks".
    const heartbeat = setInterval(() => void stream.write(': ping\n\n').catch(abort), HEARTBEAT_MS);

    try {
      await send({
        type: 'start',
        id: crypto.randomUUID(),
        provider: provider.name,
        model: provider.model,
      });
      for await (const event of provider.stream(params, upstream.signal)) {
        if (upstream.signal.aborted) break;
        await send(event);
      }
    } catch (err) {
      if (upstream.signal.aborted || isAbortError(err)) return;
      console.error(`[${provider.name}] stream failed:`, err);
      await send(toErrorEvent(err));
    } finally {
      clearInterval(heartbeat);
      c.req.raw.signal.removeEventListener('abort', abort);
    }
  });
}
