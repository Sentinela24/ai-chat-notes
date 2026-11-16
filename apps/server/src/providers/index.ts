import { createMockProvider } from './mock';
import type { LLMProvider } from './types';

export type Env = Record<string, string | undefined>;

/**
 * Picks a provider from environment variables.
 *
 *   LLM_PROVIDER=mock|anthropic|openai   (default: mock)
 *   MOCK_DELAY_MS=30                     (mock token delay)
 */
export function createProvider(env: Env): LLMProvider {
  const name = (env.LLM_PROVIDER ?? 'mock').toLowerCase();
  switch (name) {
    case 'mock':
      return createMockProvider({ delayMs: numberOr(env.MOCK_DELAY_MS, 30) });
    default:
      throw new Error(`Unknown LLM_PROVIDER "${name}". Use mock, anthropic or openai.`);
  }
}

function numberOr(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
}
