import type { ChatMessage } from '@acn/shared';
import { streamEvents, toDisplayError } from '@/lib/api/streamEvents';
import { createFrameBuffer } from '@/lib/stream/frameBuffer';
import { useChatStore } from './store';
import type { Message } from './types';

/**
 * The chat streaming lifecycle lives here, outside React.
 *
 * If it lived in a component (useEffect + local AbortController), switching to
 * the Notes view would unmount it and kill the stream. As plain module
 * functions writing to the store, a reply keeps streaming in the background
 * and any component can subscribe to the result.
 */

let controller: AbortController | null = null;

export function isStreaming() {
  return controller !== null;
}

/** Sends a user message and streams the assistant's reply. Resolves when the stream settles. */
export async function sendMessage(text: string): Promise<void> {
  const content = text.trim();
  if (!content || controller) return;
  const store = useChatStore.getState();
  store.addUserMessage(content);
  await streamReply(toApiHistory(useChatStore.getState().messages));
}

/** Cancels the in-flight reply. The partial text is kept and marked "stopped". */
export function stopStreaming() {
  controller?.abort();
}

/** Re-generates an assistant message (after an error, a stop, or just to get another answer). */
export async function retryMessage(assistantId: string): Promise<void> {
  if (controller) return;
  const { messages, removeMessage } = useChatStore.getState();
  const index = messages.findIndex((m) => m.id === assistantId && m.role === 'assistant');
  if (index === -1) return;
  const history = toApiHistory(messages.slice(0, index));
  removeMessage(assistantId);
  await streamReply(history);
}

/** The conversation as the API sees it: failed and empty messages are left out. */
export function toApiHistory(messages: Message[]): ChatMessage[] {
  return messages
    .filter((m) => (m.status === 'done' || m.status === 'stopped') && m.content.trim() !== '')
    .map(({ role, content }) => ({ role, content }));
}

async function streamReply(history: ChatMessage[]): Promise<void> {
  const store = useChatStore.getState();
  const { id } = store.startAssistantMessage();
  const ctrl = new AbortController();
  controller = ctrl;
  const buffer = createFrameBuffer((text) => useChatStore.getState().appendDelta(id, text));

  try {
    for await (const event of streamEvents('/api/chat', { messages: history }, ctrl.signal)) {
      switch (event.type) {
        case 'start':
          store.setModel(id, event.model);
          break;
        case 'delta':
          buffer.push(event.text);
          break;
        case 'done':
          buffer.flush();
          // After a refusal fallback the reply may come from a different model than `start` named.
          if (event.model) store.setModel(id, event.model);
          store.finishMessage(id, event.stopReason);
          return;
        case 'error':
          buffer.flush();
          store.failMessage(id, {
            code: event.code,
            message: event.message,
            retryable: event.retryable,
          });
          return;
      }
    }
    // The body ended without `done` or `error`: the connection was cut.
    buffer.flush();
    store.failMessage(id, {
      code: 'network',
      message: 'The connection closed before the reply finished.',
      retryable: true,
    });
  } catch (err) {
    buffer.flush();
    if (ctrl.signal.aborted) store.stopMessage(id);
    else store.failMessage(id, toDisplayError(err));
  } finally {
    buffer.cancel();
    if (controller === ctrl) controller = null;
  }
}
