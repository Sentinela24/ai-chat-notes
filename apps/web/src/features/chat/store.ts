import type { StopReason } from '@acn/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Message, MessageError } from './types';

interface ChatState {
  messages: Message[];
  /** The assistant message currently streaming, if any. Not persisted. */
  streamingId: string | null;

  addUserMessage(content: string): Message;
  startAssistantMessage(): Message;
  appendDelta(id: string, text: string): void;
  setModel(id: string, model: string): void;
  finishMessage(id: string, stopReason: StopReason): void;
  stopMessage(id: string): void;
  failMessage(id: string, error: MessageError): void;
  removeMessage(id: string): void;
  clear(): void;
}

const newId = () => crypto.randomUUID();

/** Immutable update of one message: only that message object changes, so memoised bubbles for the rest skip re-rendering. */
const patch = (messages: Message[], id: string, update: (m: Message) => Partial<Message>) =>
  messages.map((m) => (m.id === id ? { ...m, ...update(m) } : m));

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      streamingId: null,

      addUserMessage(content) {
        const message: Message = {
          id: newId(),
          role: 'user',
          content,
          status: 'done',
          createdAt: Date.now(),
        };
        set((s) => ({ messages: [...s.messages, message] }));
        return message;
      },

      startAssistantMessage() {
        const message: Message = {
          id: newId(),
          role: 'assistant',
          content: '',
          status: 'streaming',
          createdAt: Date.now(),
        };
        set((s) => ({ messages: [...s.messages, message], streamingId: message.id }));
        return message;
      },

      appendDelta(id, text) {
        set((s) => ({ messages: patch(s.messages, id, (m) => ({ content: m.content + text })) }));
      },

      setModel(id, model) {
        set((s) => ({ messages: patch(s.messages, id, () => ({ model })) }));
      },

      finishMessage(id, stopReason) {
        set((s) => ({
          messages: patch(s.messages, id, () => ({ status: 'done', stopReason })),
          streamingId: s.streamingId === id ? null : s.streamingId,
        }));
      },

      stopMessage(id) {
        set((s) => ({
          messages: patch(s.messages, id, () => ({ status: 'stopped' })),
          streamingId: s.streamingId === id ? null : s.streamingId,
        }));
      },

      failMessage(id, error) {
        set((s) => ({
          messages: patch(s.messages, id, () => ({ status: 'error', error })),
          streamingId: s.streamingId === id ? null : s.streamingId,
        }));
      },

      removeMessage(id) {
        set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
      },

      clear() {
        set({ messages: [], streamingId: null });
      },
    }),
    {
      name: 'acn:chat',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ messages: s.messages }),
      // A reload mid-stream leaves a message stuck in "streaming"; it was cut off, so mark it stopped.
      merge: (persisted, current) => {
        const messages = (persisted as Partial<ChatState> | undefined)?.messages ?? [];
        return {
          ...current,
          messages: messages.map((m) =>
            m.status === 'streaming' ? { ...m, status: 'stopped' as const } : m,
          ),
        };
      },
    },
  ),
);
