import type { ErrorCode, StreamEvent } from '@acn/shared';

/** A provider failure translated into our own vocabulary (never leaks SDK-specific shapes). */
export class ProviderError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = options.retryable ?? isRetryableCode(code);
  }
}

export function isRetryableCode(code: ErrorCode): boolean {
  return (
    code === 'rate_limited' || code === 'overloaded' || code === 'upstream' || code === 'network'
  );
}

/** Maps anything thrown during a stream to a user-safe `error` event. */
export function toErrorEvent(err: unknown): Extract<StreamEvent, { type: 'error' }> {
  if (err instanceof ProviderError) {
    return { type: 'error', code: err.code, message: err.message, retryable: err.retryable };
  }
  // Unknown errors may contain internals (stack traces, URLs, keys in headers): never forward them.
  return {
    type: 'error',
    code: 'unknown',
    message: 'Something went wrong while generating the response.',
    retryable: true,
  };
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'APIUserAbortError');
}
