import { createAnthropicProvider, DEFAULT_ANTHROPIC_MODEL, type Effort } from './anthropic';
import { createMockProvider } from './mock';
import { createOpenAIProvider, DEFAULT_OPENAI_MODEL } from './openai';
import type { LLMProvider } from './types';

export type Env = Record<string, string | undefined>;

/**
 * Picks a provider from environment variables (see apps/server/.env.example).
 *
 *   LLM_PROVIDER        mock | anthropic | openai (default: mock)
 *   ANTHROPIC_API_KEY   required for anthropic
 *   ANTHROPIC_MODEL     default claude-opus-5-5
 *   ANTHROPIC_EFFORT    low | medium | high | xhigh | max | off (default low)
 *   ANTHROPIC_FALLBACKS on | off (default: on for models that support it)
 *   OPENAI_API_KEY      required for openai
 *   OPENAI_MODEL        default gpt-5-mini
 *   MOCK_DELAY_MS       delay between mock tokens (default 30)
 */
export function createProvider(env: Env): LLMProvider {
  const name = (env.LLM_PROVIDER ?? 'mock').trim().toLowerCase();

  switch (name) {
    case 'mock':
      return createMockProvider({ delayMs: numberOr(env.MOCK_DELAY_MS, 30) });

    case 'anthropic': {
      const model = env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
      return createAnthropicProvider({
        apiKey: requireKey(env, 'ANTHROPIC_API_KEY'),
        model,
        effort: parseEffort(env.ANTHROPIC_EFFORT),
        ...(env.ANTHROPIC_FALLBACKS ? { fallbacks: parseOnOff(env.ANTHROPIC_FALLBACKS) } : {}),
      });
    }

    case 'openai':
      return createOpenAIProvider({
        apiKey: requireKey(env, 'OPENAI_API_KEY'),
        model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      });

    default:
      throw new Error(`Unknown LLM_PROVIDER "${name}". Use mock, anthropic or openai.`);
  }
}

function requireKey(env: Env, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(
      `${key} is not set. Add it to apps/server/.env, or set LLM_PROVIDER=mock to run without a key.`,
    );
  }
  return value;
}

const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

function parseEffort(value: string | undefined): Effort | null {
  const v = value?.trim().toLowerCase();
  if (!v) return 'low';
  if (v === 'off' || v === 'none') return null;
  if ((EFFORTS as readonly string[]).includes(v)) return v as Effort;
  throw new Error(`Invalid ANTHROPIC_EFFORT "${value}". Use ${EFFORTS.join(', ')} or off.`);
}

function parseOnOff(value: string): boolean {
  return !['off', 'false', '0', 'no'].includes(value.trim().toLowerCase());
}

function numberOr(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
}
