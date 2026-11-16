import { z } from 'zod';

/**
 * The wire contract between the browser and the proxy server.
 *
 * Every provider (Anthropic, OpenAI, mock) is normalised into the same small
 * set of stream events, so the UI never needs to know which LLM it talks to.
 */

export const ProviderNameSchema = z.enum(['mock', 'anthropic', 'openai']);
export type ProviderName = z.infer<typeof ProviderNameSchema>;

export const ChatRoleSchema = z.enum(['user', 'assistant']);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().min(1).max(50_000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  messages: z
    .array(ChatMessageSchema)
    .min(1)
    .max(100)
    .refine((msgs) => msgs.at(-1)?.role === 'user', {
      message: 'The last message must come from the user',
    }),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const TransformActionSchema = z.enum(['summarise', 'rewrite']);
export type TransformAction = z.infer<typeof TransformActionSchema>;

export const TransformRequestSchema = z.object({
  action: TransformActionSchema,
  text: z.string().min(1).max(20_000),
  /** Optional steer for rewrites, e.g. "make it more formal". */
  instruction: z.string().max(500).optional(),
});
export type TransformRequest = z.infer<typeof TransformRequestSchema>;

/** Why the model stopped. `refusal` is a normal stop, not a transport error. */
export const StopReasonSchema = z.enum(['end_turn', 'max_tokens', 'refusal', 'other']);
export type StopReason = z.infer<typeof StopReasonSchema>;

export const ErrorCodeSchema = z.enum([
  'bad_request',
  'auth',
  'rate_limited',
  'overloaded',
  'upstream',
  'network',
  'unknown',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const UsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const StreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    id: z.string(),
    provider: ProviderNameSchema,
    model: z.string(),
  }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('done'),
    stopReason: StopReasonSchema,
    usage: UsageSchema.optional(),
    /** The model that actually produced the reply (can differ from `start` after a fallback). */
    model: z.string().optional(),
  }),
  z.object({
    type: z.literal('error'),
    code: ErrorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
  }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export const ConfigResponseSchema = z.object({
  provider: ProviderNameSchema,
  model: z.string(),
  mock: z.boolean(),
});
export type ConfigResponse = z.infer<typeof ConfigResponseSchema>;

/** Shape of non-streaming JSON errors (e.g. a 400 before the stream opens). */
export const ApiErrorBodySchema = z.object({
  error: z.object({ code: ErrorCodeSchema, message: z.string() }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
