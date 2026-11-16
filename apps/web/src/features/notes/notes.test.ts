import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/app/uiStore';
import type { Message } from '../chat/types';
import { saveReplyToNotes } from './saveReply';
import { selectActiveNote, useNotesStore } from './store';

const notes = () => useNotesStore.getState();

beforeEach(() => {
  useNotesStore.setState({ notes: [], activeId: null });
  useUiStore.setState({ view: 'chat', toast: null });
});

describe('notes store', () => {
  it('creates notes newest-first and makes the new one active', () => {
    const a = notes().createNote({ title: 'A' });
    const b = notes().createNote({ title: 'B' });
    expect(notes().notes.map((n) => n.title)).toEqual(['B', 'A']);
    expect(notes().activeId).toBe(b.id);
    expect(selectActiveNote(notes())?.id).toBe(b.id);
    expect(a.id).not.toBe(b.id);
  });

  it('deleting the active note selects another, and restore brings it back', () => {
    const a = notes().createNote({ title: 'A' });
    const b = notes().createNote({ title: 'B' });
    const removed = notes().deleteNote(b.id)!;
    expect(notes().activeId).toBe(a.id);

    notes().restoreNote(removed);
    expect(notes().notes.map((n) => n.title)).toEqual(['B', 'A']);
    expect(notes().activeId).toBe(b.id);
  });
});

describe('saveReplyToNotes', () => {
  const reply: Message = {
    id: 'm1',
    role: 'assistant',
    content: '## Streaming\n\nUse **SSE** for one-way updates.',
    status: 'done',
    createdAt: 0,
  };

  it('converts the reply to a titled HTML note without leaving the chat', () => {
    const note = saveReplyToNotes(reply);
    expect(note.title).toBe('Streaming');
    expect(note.html).toContain('<strong>SSE</strong>');
    expect(useUiStore.getState().view).toBe('chat');
  });

  it('offers an Open action that switches to the note', () => {
    const note = saveReplyToNotes(reply);
    notes().createNote({ title: 'Something else' });

    useUiStore.getState().toast!.action!.onClick();

    expect(useUiStore.getState().view).toBe('notes');
    expect(notes().activeId).toBe(note.id);
  });
});
