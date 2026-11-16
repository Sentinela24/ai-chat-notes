import { describe, expect, it } from 'vitest';
import { ProviderError } from './errors';
import { createMockProvider, tokenize } from './mock';
import type { CompletionParams, ProviderEvent } from './types';

const params = (content: string, task: CompletionParams['task'] = 'chat'): CompletionParams => ({
  task,
  system: 'sys',
  messages: [{ role: 'user', content }],
  maxTokens: 100,
});

async function collect(iter: AsyncIterable<ProviderEvent>) {
  const events: ProviderEvent[] = [];
  for await (const e of iter) events.push(e);
  return events;
}

describe('tokenize', () => {
  it('splits into chunks that join back to the original text', () => {
    const text = 'Hello  world,\nthis is **markdown**.';
    expect(tokenize(text).join('')).toBe(text);
  });
});

describe('mock provider', () => {
  const mock = createMockProvider({ delayMs: 0 });

  it('streams deltas followed by a done event', async () => {
    const events = await collect(mock.stream(params('hi'), new AbortController().signal));
    const last = events.at(-1);
    expect(events.length).toBeGreaterThan(10);
    expect(last).toMatchObject({ type: 'done', stopReason: 'end_turn' });
    const text = events.flatMap((e) => (e.type === 'delta' ? [e.text] : [])).join('');
    expect(text).toContain('**mock** reply to: "hi"');
  });

  it('is deterministic', async () => {
    const a = await collect(mock.stream(params('same'), new AbortController().signal));
    const b = await collect(mock.stream(params('same'), new AbortController().signal));
    expect(a).toEqual(b);
  });

  it('fails mid-stream on /error, after emitting some text', async () => {
    const seen: ProviderEvent[] = [];
    const run = async () => {
      for await (const e of mock.stream(params('please /error'), new AbortController().signal))
        seen.push(e);
    };
    await expect(run()).rejects.toBeInstanceOf(ProviderError);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((e) => e.type === 'delta')).toBe(true);
  });

  it('fails before any token on /fail', async () => {
    const seen: ProviderEvent[] = [];
    const run = async () => {
      for await (const e of mock.stream(params('/fail'), new AbortController().signal))
        seen.push(e);
    };
    await expect(run()).rejects.toMatchObject({ code: 'overloaded', retryable: true });
    expect(seen).toEqual([]);
  });

  it('ends with a refusal stop reason on /refuse', async () => {
    const events = await collect(mock.stream(params('/refuse'), new AbortController().signal));
    expect(events.at(-1)).toMatchObject({ type: 'done', stopReason: 'refusal' });
  });

  it('stops when the signal aborts', async () => {
    const controller = new AbortController();
    const seen: ProviderEvent[] = [];
    const run = async () => {
      for await (const e of mock.stream(params('hi'), controller.signal)) {
        seen.push(e);
        if (seen.length === 3) controller.abort();
      }
    };
    await expect(run()).rejects.toMatchObject({ name: 'AbortError' });
    expect(seen).toHaveLength(3);
  });

  it('summarises and rewrites the passage, not the instructions', async () => {
    const passage = '<passage>\nthe quick brown fox. it jumps.\n</passage>';
    const summary = await collect(
      mock.stream(
        params(`Summarise this.\n\n${passage}`, 'summarise'),
        new AbortController().signal,
      ),
    );
    const rewrite = await collect(
      mock.stream(params(`Rewrite this.\n\n${passage}`, 'rewrite'), new AbortController().signal),
    );
    const text = (events: ProviderEvent[]) =>
      events.flatMap((e) => (e.type === 'delta' ? [e.text] : [])).join('');
    expect(text(summary)).toMatch(/^\*\*Summary \(mock\):\*\* the quick brown fox/);
    expect(text(rewrite)).toMatch(/^The quick brown fox\. It jumps\./);
  });
});
