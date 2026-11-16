import { describe, expect, it } from 'vitest';
import { SSEParser, readSSE } from './sse';

function feedAll(chunks: string[]) {
  const parser = new SSEParser();
  return chunks.flatMap((c) => parser.feed(c));
}

describe('SSEParser', () => {
  it('parses a simple event', () => {
    expect(feedAll(['event: delta\ndata: {"a":1}\n\n'])).toEqual([
      { event: 'delta', data: '{"a":1}' },
    ]);
  });

  it('defaults the event name to "message"', () => {
    expect(feedAll(['data: hi\n\n'])).toEqual([{ event: 'message', data: 'hi' }]);
  });

  it('joins multiple data lines with newlines', () => {
    expect(feedAll(['data: line 1\ndata: line 2\n\n'])).toEqual([
      { event: 'message', data: 'line 1\nline 2' },
    ]);
  });

  it('handles messages split across arbitrary chunk boundaries', () => {
    const wire = 'event: delta\ndata: hello\n\nevent: done\ndata: bye\n\n';
    // Split the wire at every possible position and expect the same result.
    for (let i = 1; i < wire.length; i++) {
      expect(feedAll([wire.slice(0, i), wire.slice(i)])).toEqual([
        { event: 'delta', data: 'hello' },
        { event: 'done', data: 'bye' },
      ]);
    }
  });

  it('supports \\r\\n and \\r line endings, even when \\r\\n is split', () => {
    expect(feedAll(['data: a\r\n\r\n', 'data: b\r\r'])).toEqual([
      { event: 'message', data: 'a' },
      { event: 'message', data: 'b' },
    ]);
    expect(feedAll(['data: a\r', '\n\r', '\n'])).toEqual([{ event: 'message', data: 'a' }]);
  });

  it('ignores comments (heartbeats) and unknown fields', () => {
    expect(feedAll([': ping\n\nretry: 1000\nfoo: bar\ndata: x\n\n'])).toEqual([
      { event: 'message', data: 'x' },
    ]);
  });

  it('only strips one leading space from values', () => {
    expect(feedAll(['data:  two spaces\n\n'])).toEqual([{ event: 'message', data: ' two spaces' }]);
  });

  it('remembers the last event id', () => {
    expect(feedAll(['id: 1\ndata: a\n\ndata: b\n\n'])).toEqual([
      { event: 'message', data: 'a', id: '1' },
      { event: 'message', data: 'b', id: '1' },
    ]);
  });

  it('does not dispatch an event without data', () => {
    expect(feedAll(['event: lonely\n\n'])).toEqual([]);
  });
});

describe('readSSE', () => {
  it('reads messages from a byte stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: one\n'));
        controller.enqueue(encoder.encode('\ndata: two\n\n'));
        controller.close();
      },
    });
    const out = [];
    for await (const msg of readSSE(stream)) out.push(msg.data);
    expect(out).toEqual(['one', 'two']);
  });

  it('decodes multi-byte characters split across chunks', async () => {
    const bytes = new TextEncoder().encode('data: héllo 👋\n\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Split byte-by-byte to cut through every multi-byte sequence.
        for (const b of bytes) controller.enqueue(new Uint8Array([b]));
        controller.close();
      },
    });
    const out = [];
    for await (const msg of readSSE(stream)) out.push(msg.data);
    expect(out).toEqual(['héllo 👋']);
  });

  it('cancels the source stream when the consumer stops early', async () => {
    let cancelled = false;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: one\n\ndata: two\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    for await (const msg of readSSE(stream)) {
      expect(msg.data).toBe('one');
      break;
    }
    expect(cancelled).toBe(true);
  });
});
