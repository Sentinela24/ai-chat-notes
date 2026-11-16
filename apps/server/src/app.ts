import {
  ChatRequestSchema,
  TransformRequestSchema,
  type ApiErrorBody,
  type ConfigResponse,
} from '@acn/shared';
import { Hono, type Context } from 'hono';
import type { z } from 'zod';
import { buildTransformPrompt, CHAT_SYSTEM_PROMPT } from './prompts';
import type { LLMProvider } from './providers/types';
import { streamCompletion } from './sse';

export interface AppOptions {
  provider: LLMProvider;
  maxTokens?: number;
}

/** Builds the Hono app. Kept separate from `index.ts` so tests can call `app.request()` without a port. */
export function createApp({ provider, maxTokens = 16_000 }: AppOptions) {
  const app = new Hono().basePath('/api');

  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/config', (c) =>
    c.json<ConfigResponse>({
      provider: provider.name,
      model: provider.model,
      mock: provider.name === 'mock',
    }),
  );

  app.post('/chat', async (c) => {
    const body = await parseBody(c, ChatRequestSchema);
    if (!body.ok) return body.response;
    return streamCompletion(c, provider, {
      task: 'chat',
      system: CHAT_SYSTEM_PROMPT,
      messages: body.data.messages,
      maxTokens,
    });
  });

  app.post('/transform', async (c) => {
    const body = await parseBody(c, TransformRequestSchema);
    if (!body.ok) return body.response;
    const prompt = buildTransformPrompt(body.data);
    return streamCompletion(c, provider, {
      task: body.data.action,
      ...prompt,
      maxTokens: Math.min(maxTokens, 8_000),
    });
  });

  return app;
}

/** Validates the JSON body before the stream opens, so bad input gets a proper 400 (not an in-band error). */
async function parseBody<T extends z.ZodType>(
  c: Context,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return { ok: false, response: badRequest(c, 'Request body must be JSON.') };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    return { ok: false, response: badRequest(c, `${where}${issue?.message ?? 'Invalid request'}`) };
  }
  return { ok: true, data: result.data };
}

function badRequest(c: Context, message: string) {
  return c.json<ApiErrorBody>({ error: { code: 'bad_request', message } }, 400);
}
