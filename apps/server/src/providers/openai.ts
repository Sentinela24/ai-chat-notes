import OpenAI from 'openai';
import type { StopReason } from '@acn/shared';
import { toProviderError } from './sdkErrors';
import type { CompletionParams, LLMProvider, ProviderEvent } from './types';

export interface OpenAIProviderOptions {
  apiKey: string;
  model?: string;
  /** Injected in tests. */
  client?: Pick<OpenAI, 'chat'>;
}

export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';

export function createOpenAIProvider({
  apiKey,
  model = DEFAULT_OPENAI_MODEL,
  client = new OpenAI({ apiKey, maxRetries: 2 }),
}: OpenAIProviderOptions): LLMProvider {
  return {
    name: 'openai',
    model,
    async *stream(params: CompletionParams, signal: AbortSignal): AsyncGenerator<ProviderEvent> {
      try {
        const stream = await client.chat.completions.create(
          {
            model,
            stream: true,
            stream_options: { include_usage: true },
            max_completion_tokens: params.maxTokens,
            // OpenAI takes the system prompt as the first message.
            messages: [{ role: 'system', content: params.system }, ...params.messages],
          },
          { signal },
        );

        let stopReason: StopReason = 'other';
        let servedBy = model;
        let usage: { inputTokens: number; outputTokens: number } | undefined;

        for await (const chunk of stream) {
          servedBy = chunk.model || servedBy;
          const choice = chunk.choices[0];
          const text = choice?.delta?.content;
          if (text) yield { type: 'delta', text };
          if (choice?.finish_reason) stopReason = mapFinishReason(choice.finish_reason);
          // With include_usage, the last chunk has no choices and carries the totals.
          if (chunk.usage) {
            usage = {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
            };
          }
        }

        yield { type: 'done', stopReason, model: servedBy, ...(usage ? { usage } : {}) };
      } catch (err) {
        throw mapOpenAIError(err);
      }
    },
  };
}

export function mapFinishReason(reason: string): StopReason {
  switch (reason) {
    case 'stop':
      return 'end_turn';
    case 'length':
      return 'max_tokens';
    case 'content_filter':
      return 'refusal';
    default:
      return 'other';
  }
}

export function mapOpenAIError(err: unknown): unknown {
  if (err instanceof OpenAI.APIUserAbortError) return err;
  if (err instanceof OpenAI.APIError) {
    return toProviderError(
      'OpenAI',
      {
        status: err.status,
        type: err.type,
        isConnectionError: err instanceof OpenAI.APIConnectionError,
        message: err.message,
      },
      err,
    );
  }
  return err;
}
