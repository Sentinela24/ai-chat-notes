/**
 * A tiny, spec-following Server-Sent Events parser.
 *
 * Why not `EventSource`? It only supports GET (no JSON body), cannot send
 * custom headers and cannot be cancelled with an AbortController. Streaming a
 * chat completion needs a POST, so we read `fetch()`'s body stream ourselves.
 *
 * The parser is a pure state machine (`feed()` in, messages out) so it can be
 * unit-tested with arbitrary chunk boundaries: network chunks can split a
 * message, a line, or even a `\r\n` pair anywhere.
 *
 * Spec: https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
 */

export interface SSEMessage {
  event: string;
  data: string;
  id?: string;
}

export class SSEParser {
  private buffer = '';
  private dataLines: string[] = [];
  private eventType = '';
  private lastEventId: string | undefined;
  /** A chunk ended in `\r`; if the next one starts with `\n` it is the same line break. */
  private pendingCR = false;

  feed(chunk: string): SSEMessage[] {
    const messages: SSEMessage[] = [];
    let text = chunk;
    if (this.pendingCR) {
      this.pendingCR = false;
      if (text.startsWith('\n')) text = text.slice(1);
    }
    this.buffer += text;

    let lineStart = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (ch !== '\n' && ch !== '\r') continue;

      const line = this.buffer.slice(lineStart, i);
      if (ch === '\r') {
        if (i + 1 < this.buffer.length) {
          if (this.buffer[i + 1] === '\n') i++;
        } else {
          this.pendingCR = true;
        }
      }
      lineStart = i + 1;

      const message = this.processLine(line);
      if (message) messages.push(message);
    }

    this.buffer = this.buffer.slice(lineStart);
    return messages;
  }

  private processLine(line: string): SSEMessage | null {
    // A blank line dispatches the event being built.
    if (line === '') {
      if (this.dataLines.length === 0) {
        this.eventType = '';
        return null;
      }
      const message: SSEMessage = {
        event: this.eventType || 'message',
        data: this.dataLines.join('\n'),
      };
      if (this.lastEventId !== undefined) message.id = this.lastEventId;
      this.dataLines = [];
      this.eventType = '';
      return message;
    }

    // Lines starting with ':' are comments (the server uses them as heartbeats).
    if (line.startsWith(':')) return null;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'data':
        this.dataLines.push(value);
        break;
      case 'event':
        this.eventType = value;
        break;
      case 'id':
        if (!value.includes('\u0000')) this.lastEventId = value;
        break;
      default:
        // `retry` and unknown fields are ignored.
        break;
    }
    return null;
  }
}

/**
 * Turns a byte stream (e.g. `response.body`) into SSE messages.
 * Stopping early (breaking out of `for await`) cancels the underlying stream,
 * which closes the HTTP connection.
 */
export async function* readSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEMessage> {
  const reader = stream.getReader();
  // `stream: true` keeps a multi-byte UTF-8 character (e.g. an emoji) that is
  // split across two network chunks from being decoded as garbage.
  const decoder = new TextDecoder();
  const parser = new SSEParser();
  let finished = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        finished = true;
        yield* parser.feed(decoder.decode());
        return;
      }
      yield* parser.feed(decoder.decode(value, { stream: true }));
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
