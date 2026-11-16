import type { ChatMessage, ProviderName, StopReason, Usage } from '@acn/shared';

export type Task = 'chat' | 'summarise' | 'rewrite';

export interface CompletionParams {
  /** What the request is for. Providers may ignore it; the mock uses it to fake a plausible reply. */
  task: Task;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
}

/** What a provider yields. The route adds the `start` event and maps thrown errors to `error`. */
export type ProviderEvent =
  { type: 'delta'; text: string } | { type: 'done'; stopReason: StopReason; usage?: Usage };

/**
 * The seam that makes providers swappable. Each adapter turns its SDK's own
 * streaming format into `ProviderEvent`s, and must stop (and stop billing)
 * when `signal` aborts.
 */
export interface LLMProvider {
  readonly name: ProviderName;
  readonly model: string;
  stream(params: CompletionParams, signal: AbortSignal): AsyncIterable<ProviderEvent>;
}
