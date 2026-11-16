import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  createAnthropicProvider,
  mapAnthropicError,
  mapStopReason,
  supportsServerFallbacks,
} from './anthropic';
import { ProviderError } from './errors';
import { createProvider } from './index';
import { createOpenAIProvider, mapFinishReason } from './openai';
import { toProviderError } from './sdkErrors';
import type { CompletionParams, ProviderEvent } from './types';

const params: CompletionParams = {
  task: 'chat',
  system: 'Be brief.',
  messages: [{ role: 'user', content: 'Hi' }],
  maxTokens: 1000,
};

async function collect(iter: AsyncIterable<ProviderEvent>) {
  const out: ProviderEvent[] = [];
  for await (const e of iter) out.push(e);
  return out;
}

function fakeAnthropicStream(events: unknown[], finalMessage: unknown) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* events;
    },
    finalMessage: () => Promise.resolve(finalMessage),
  };
}

describe('anthropic provider', () => {
  it('streams text deltas only and maps the final message', async () => {
    const stream = vi.fn().mockReturnValue(
      fakeAnthropicStream(
        [
          { type: 'message_start' },
          { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: '...' } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: ' there' } },
          { type: 'message_stop' },
        ],
        {
          model: 'claude-opus-5-5',
          stop_reason: 'end_turn',
          usage: { input_tokens: 12, output_tokens: 3 },
        },
      ),
    );
    const provider = createAnthropicProvider({
      apiKey: 'test',
      client: { beta: { messages: { stream } } } as never,
    });
    const signal = new AbortController().signal;

    const events = await collect(provider.stream(params, signal));

    expect(events).toEqual([
      { type: 'delta', text: 'Hello' },
      { type: 'delta', text: ' there' },
      {
        type: 'done',
        stopReason: 'end_turn',
        model: 'claude-opus-5-5',
        usage: { inputTokens: 12, outputTokens: 3 },
      },
    ]);

    const [body, options] = stream.mock.calls[0]!;
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 1000,
      system: 'Be brief.',
      messages: params.messages,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    expect(body).not.toHaveProperty('thinking');
    expect(options).toEqual({ signal });
  });

  it('omits effort and fallbacks when disabled', async () => {
    const stream = vi.fn().mockReturnValue(
      fakeAnthropicStream([], {
        model: 'claude-haiku-4-5',
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    );
    const provider = createAnthropicProvider({
      apiKey: 'test',
      model: 'claude-haiku-4-5',
      effort: null,
      client: { beta: { messages: { stream } } } as never,
    });
    await collect(provider.stream(params, new AbortController().signal));
    const [body] = stream.mock.calls[0]!;
    expect(body).not.toHaveProperty('output_config');
    expect(body).not.toHaveProperty('fallbacks');
  });

  it('passes our own aborts through untouched', () => {
    const abort = new Anthropic.APIUserAbortError();
    expect(mapAnthropicError(abort)).toBe(abort);
  });

  it('maps connection errors to retryable network errors', () => {
    const err = mapAnthropicError(new Anthropic.APIConnectionError({ message: 'ECONNRESET' }));
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toMatchObject({ code: 'network', retryable: true });
  });

  it('knows which models support server-side fallbacks', () => {
    expect(supportsServerFallbacks('claude-opus-5-5')).toBe(true);
    expect(supportsServerFallbacks('claude-sonnet-5-5')).toBe(true);
    expect(supportsServerFallbacks('claude-haiku-4-5')).toBe(false);
  });

  it('maps stop reasons', () => {
    expect(mapStopReason('stop_sequence')).toBe('end_turn');
    expect(mapStopReason('max_tokens')).toBe('max_tokens');
    expect(mapStopReason('refusal')).toBe('refusal');
    expect(mapStopReason('pause_turn')).toBe('other');
  });
});

describe('openai provider', () => {
  it('prepends the system prompt and reads usage from the final chunk', async () => {
    const chunks = [
      { model: 'gpt-5-mini', choices: [{ delta: { content: 'Hi' }, finish_reason: null }] },
      { model: 'gpt-5-mini', choices: [{ delta: { content: '!' }, finish_reason: 'stop' }] },
      { model: 'gpt-5-mini', choices: [], usage: { prompt_tokens: 9, completion_tokens: 2 } },
    ];
    const create = vi.fn().mockResolvedValue(
      (async function* () {
        yield* chunks;
      })(),
    );
    const provider = createOpenAIProvider({
      apiKey: 'test',
      client: { chat: { completions: { create } } } as never,
    });

    const events = await collect(provider.stream(params, new AbortController().signal));

    expect(events).toEqual([
      { type: 'delta', text: 'Hi' },
      { type: 'delta', text: '!' },
      {
        type: 'done',
        stopReason: 'end_turn',
        model: 'gpt-5-mini',
        usage: { inputTokens: 9, outputTokens: 2 },
      },
    ]);
    expect(create.mock.calls[0]![0].messages[0]).toEqual({ role: 'system', content: 'Be brief.' });
  });

  it('maps finish reasons', () => {
    expect(mapFinishReason('length')).toBe('max_tokens');
    expect(mapFinishReason('content_filter')).toBe('refusal');
  });
});

describe('toProviderError', () => {
  const info = { status: undefined, isConnectionError: false, message: 'boom' };

  it.each([
    [{ ...info, status: 401 }, 'auth', false],
    [{ ...info, status: 429 }, 'rate_limited', true],
    [{ ...info, status: 529 }, 'overloaded', true],
    // Mid-stream errors arrive without a status, only a type.
    [{ ...info, type: 'overloaded_error' }, 'overloaded', true],
    [{ ...info, status: 400 }, 'bad_request', false],
    [{ ...info, status: 500 }, 'upstream', true],
    [{ ...info, isConnectionError: true }, 'network', true],
  ])('%o -> %s', (input, code, retryable) => {
    expect(toProviderError('Anthropic', input, null)).toMatchObject({ code, retryable });
  });

  it('only includes the provider message for bad requests', () => {
    expect(toProviderError('X', { ...info, status: 400 }, null).message).toContain('boom');
    expect(toProviderError('X', { ...info, status: 500 }, null).message).not.toContain('boom');
  });
});

describe('createProvider', () => {
  it('defaults to mock', () => {
    expect(createProvider({}).name).toBe('mock');
  });

  it('builds the anthropic provider with the default model', () => {
    const p = createProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' });
    expect(p).toMatchObject({ name: 'anthropic', model: 'claude-opus-5-5' });
  });

  it('explains how to fix a missing key', () => {
    expect(() => createProvider({ LLM_PROVIDER: 'openai' })).toThrow(
      /OPENAI_API_KEY.*LLM_PROVIDER=mock/,
    );
  });

  it('rejects an invalid effort', () => {
    expect(() =>
      createProvider({
        LLM_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'k',
        ANTHROPIC_EFFORT: 'turbo',
      }),
    ).toThrow(/ANTHROPIC_EFFORT/);
  });
});
