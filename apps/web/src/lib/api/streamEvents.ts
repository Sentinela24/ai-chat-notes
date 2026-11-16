import {
  ApiErrorBodySchema,
  readSSE,
  StreamEventSchema,
  type ErrorCode,
  type StreamEvent,
} from '@acn/shared';

/** An error we can show to the user, with enough info to decide whether to offer Retry. */
export class StreamRequestError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = 'StreamRequestError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * POSTs `body` to an SSE endpoint and yields validated stream events.
 *
 * Uses fetch + ReadableStream instead of EventSource because we need a POST
 * body and AbortController support. Aborting `signal` cancels the request and
 * the server, in turn, cancels the upstream LLM call.
 */
export async function* streamEvents(
  url: string,
  body: unknown,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new StreamRequestError(
      'network',
      'Could not reach the server. Check that it is running and try again.',
      true,
    );
  }

  if (!res.ok || !res.body) throw await toHttpError(res);

  for await (const message of readSSE(res.body)) {
    let json: unknown;
    try {
      json = JSON.parse(message.data);
    } catch {
      continue;
    }
    const parsed = StreamEventSchema.safeParse(json);
    // Unknown event types are skipped rather than fatal, so the server can add
    // new events without breaking older clients.
    if (parsed.success) yield parsed.data;
  }
}

async function toHttpError(res: Response): Promise<StreamRequestError> {
  const body = ApiErrorBodySchema.safeParse(await res.json().catch(() => null));
  const message = body.success ? body.data.error.message : `Request failed (${res.status}).`;
  if (res.status === 400) return new StreamRequestError('bad_request', message, false);
  if (res.status === 401 || res.status === 403)
    return new StreamRequestError('auth', message, false);
  if (res.status === 429) return new StreamRequestError('rate_limited', message, true);
  return new StreamRequestError('upstream', message, true);
}

/** Normalises anything thrown while streaming into a displayable error. */
export function toDisplayError(err: unknown): {
  code: ErrorCode;
  message: string;
  retryable: boolean;
} {
  if (err instanceof StreamRequestError) {
    return { code: err.code, message: err.message, retryable: err.retryable };
  }
  // A TypeError mid-read usually means the connection dropped.
  return {
    code: 'network',
    message: 'The connection was interrupted before the reply finished.',
    retryable: true,
  };
}
