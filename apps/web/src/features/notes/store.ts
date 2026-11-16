import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface Note {
  id: string;
  title: string;
  /** TipTap content, stored as HTML (portable, and what `setContent` accepts directly). */
  html: string;
  createdAt: number;
  updatedAt: number;
}

interface NotesState {
  notes: Note[];
  activeId: string | null;

  createNote(input?: { title?: string; html?: string }): Note;
  updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'html'>>): void;
  /** Returns what's needed to undo the delete. */
  deleteNote(id: string): { note: Note; index: number } | undefined;
  restoreNote(deleted: { note: Note; index: number }): void;
  setActive(id: string | null): void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      activeId: null,

      createNote({ title = 'Untitled note', html = '' } = {}) {
        const now = Date.now();
        const note: Note = { id: crypto.randomUUID(), title, html, createdAt: now, updatedAt: now };
        set((s) => ({ notes: [note, ...s.notes], activeId: note.id }));
        return note;
      },

      updateNote(id, patch) {
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
        }));
      },

      deleteNote(id) {
        const index = get().notes.findIndex((n) => n.id === id);
        const note = get().notes[index];
        if (!note) return undefined;
        set((s) => {
          const notes = s.notes.filter((n) => n.id !== id);
          return { notes, activeId: s.activeId === id ? (notes[0]?.id ?? null) : s.activeId };
        });
        return { note, index };
      },

      restoreNote({ note, index }) {
        set((s) => {
          const notes = [...s.notes];
          notes.splice(Math.min(index, notes.length), 0, note);
          return { notes, activeId: note.id };
        });
      },

      setActive(id) {
        set({ activeId: id });
      },
    }),
    { name: 'acn:notes', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export const selectActiveNote = (s: NotesState): Note | undefined =>
  s.notes.find((n) => n.id === s.activeId) ?? s.notes[0];
