import Anthropic from '@anthropic-ai/sdk';
import type { StopReason } from '@acn/shared';
import { toProviderError } from './sdkErrors';
import type { CompletionParams, LLMProvider, ProviderEvent } from './types';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  /**
   * How much the model thinks before answering. Claude Opus 5.5 always uses
   * adaptive thinking; `effort` is the dial. `low` keeps chat replies starting
   * fast. `null` leaves it to the API default (needed for older models that
   * don't accept the parameter).
   */
  effort?: Effort | null;
  /**
   * Server-side refusal fallback: if the model declines on policy grounds, the
   * API re-runs the request on a fallback model inside the same stream.
   * Already-streamed text is kept and the fallback continues from it.
   */
  fallbacks?: boolean;
  /** Injected in tests. */
  client?: Pick<Anthropic, 'beta'>;
}

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

/** Models that accept `fallbacks: "default"` (server-side refusal fallback). */
export function supportsServerFallbacks(model: string): boolean {
  return /^claude-(opus-5|fable-5|mythos-5|sonnet-5-5)/.test(model);
}

export function createAnthropicProvider({
  apiKey,
  model = DEFAULT_ANTHROPIC_MODEL,
  effort = 'low',
  fallbacks = supportsServerFallbacks(model),
  client = new Anthropic({ apiKey, maxRetries: 2 }),
}: AnthropicProviderOptions): LLMProvider {
  return {
    name: 'anthropic',
    model,
    async *stream(params: CompletionParams, signal: AbortSignal): AsyncGenerator<ProviderEvent> {
      try {
        // The SDK retries 429/5xx itself (maxRetries) before the stream opens.
        const stream = client.beta.messages.stream(
          {
            model,
            max_tokens: params.maxTokens,
            system: params.system,
            messages: params.messages,
            ...(effort ? { output_config: { effort } } : {}),
            ...(fallbacks
              ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
              : {}),
          },
          // Aborting this signal closes the HTTP request to Anthropic, which stops generation (and billing).
          { signal },
        );

        for await (const event of stream) {
          // Thinking blocks are skipped: only the answer text is streamed to the UI.
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield { type: 'delta', text: event.delta.text };
          }
        }

        const message = await stream.finalMessage();
        yield {
          type: 'done',
          stopReason: mapStopReason(message.stop_reason),
          model: message.model,
          usage: {
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
          },
        };
      } catch (err) {
        throw mapAnthropicError(err);
      }
    },
  };
}

export function mapStopReason(reason: string | null | undefined): StopReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'end_turn';
    case 'max_tokens':
      return 'max_tokens';
    case 'refusal':
      return 'refusal';
    default:
      return 'other';
  }
}

export function mapAnthropicError(err: unknown): unknown {
  // Our own abort: rethrow untouched so the route treats it as a cancel, not a failure.
  if (err instanceof Anthropic.APIUserAbortError) return err;
  if (err instanceof Anthropic.APIError) {
    return toProviderError(
      'Anthropic',
      {
        status: err.status,
        type: err.type,
        isConnectionError: err instanceof Anthropic.APIConnectionError,
        message: err.message,
      },
      err,
    );
  }
  return err;
}
