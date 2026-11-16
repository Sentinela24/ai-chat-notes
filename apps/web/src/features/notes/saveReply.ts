import { useUiStore } from '@/app/uiStore';
import { markdownToHtml, titleFromMarkdown } from '@/lib/markdown';
import type { Message } from '../chat/types';
import { useNotesStore } from './store';

/**
 * Saves a chat reply as a new note. Stays on the chat (no surprise navigation
 * mid-conversation) and offers an "Open" action in a toast instead.
 */
export function saveReplyToNotes(message: Message) {
  const note = useNotesStore.getState().createNote({
    title: titleFromMarkdown(message.content),
    html: markdownToHtml(message.content),
  });
  const ui = useUiStore.getState();
  ui.showToast({
    message: `Saved to notes as "${note.title}"`,
    action: {
      label: 'Open',
      onClick: () => {
        useNotesStore.getState().setActive(note.id);
        useUiStore.getState().setView('notes');
      },
    },
  });
  return note;
}
