import { useChatStore } from './store';
import { retryMessage, sendMessage, stopStreaming } from './chatActions';

/** Thin React-facing API over the chat store and streaming actions. */
export function useChat() {
  const messages = useChatStore((s) => s.messages);
  const streamingId = useChatStore((s) => s.streamingId);
  const clear = useChatStore((s) => s.clear);

  return {
    messages,
    streamingId,
    isStreaming: streamingId !== null,
    send: sendMessage,
    stop: stopStreaming,
    retry: retryMessage,
    clear,
  };
}
