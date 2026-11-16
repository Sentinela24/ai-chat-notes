import { FilePlus2 } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useUiStore } from '@/app/uiStore';
import { Button } from '@/components/ui/Button';
import { debounce } from '@/lib/debounce';
import { markdownToHtml } from '@/lib/markdown';
import { selectActiveNote, useNotesStore } from '../store';
import { useAiTransform } from '../useAiTransform';
import { AiPreviewPanel } from './AiPreviewPanel';
import { NoteEditor, type NoteEditorHandle } from './NoteEditor';
import { NoteList } from './NoteList';

export function NotesView() {
  const notes = useNotesStore((s) => s.notes);
  const active = useNotesStore(selectActiveNote);
  const { createNote, updateNote, deleteNote, restoreNote, setActive } = useNotesStore.getState();
  const showToast = useUiStore((s) => s.showToast);

  const editorRef = useRef<NoteEditorHandle>(null);
  const ai = useAiTransform();
  const pending = ai.state.status !== 'idle';

  // Persisting HTML on every keystroke is wasteful; debounce per note.
  const saveHtml = useMemo(
    () => debounce((id: string, html: string) => updateNote(id, { html }), 300),
    [updateNote],
  );
  useEffect(() => () => saveHtml.flush(), [saveHtml]);

  // Switching notes abandons any pending suggestion (its range belongs to the old document).
  const activeId = active?.id;
  const { reset } = ai;
  useEffect(() => reset(), [activeId, reset]);

  const onDelete = (id: string) => {
    saveHtml.flush();
    const removed = deleteNote(id);
    if (removed) {
      showToast({
        message: `Deleted "${removed.note.title}"`,
        action: { label: 'Undo', onClick: () => restoreNote(removed) },
      });
    }
  };

  const accept = (mode: 'replace' | 'insert') => {
    if (ai.state.status === 'idle') return;
    const html = markdownToHtml(ai.state.text);
    const { range } = ai.state;
    ai.reset();
    // Wait for the editor to become editable again before writing.
    queueMicrotask(() => {
      if (mode === 'replace') editorRef.current?.replaceRange(range, html);
      else editorRef.current?.insertAfter(range.to, html);
    });
  };

  if (!active) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 id="view-heading" tabIndex={-1} className="text-lg font-medium focus:outline-none">
          No notes yet
        </h2>
        <p className="max-w-sm text-sm text-muted">
          Create a note, or use “Save to notes” on any chat reply.
        </p>
        <Button
          variant="primary"
          icon={<FilePlus2 className="size-4" aria-hidden />}
          onClick={() => createNote()}
        >
          Create a note
        </Button>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr] md:grid-cols-[16rem_1fr] md:grid-rows-1">
      <aside className="max-h-48 border-b border-border p-3 md:max-h-none md:border-r md:border-b-0">
        <NoteList
          notes={notes}
          activeId={active.id}
          onSelect={(id) => {
            saveHtml.flush();
            setActive(id);
          }}
          onCreate={() => {
            saveHtml.flush();
            createNote();
          }}
          onDelete={onDelete}
          disabled={pending}
        />
      </aside>

      <section aria-label="Editor" className="min-h-0 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4">
          <h2 id="view-heading" tabIndex={-1} className="sr-only">
            Notes
          </h2>
          <label className="sr-only" htmlFor="note-title">
            Note title
          </label>
          <input
            id="note-title"
            key={`title-${active.id}`}
            defaultValue={active.title}
            onChange={(e) => updateNote(active.id, { title: e.target.value })}
            placeholder="Untitled note"
            className="bg-transparent text-2xl font-semibold placeholder:text-muted focus:outline-none"
          />

          {pending && ai.state.status !== 'idle' && (
            <AiPreviewPanel
              state={ai.state}
              onStop={ai.stop}
              onReplace={() => accept('replace')}
              onInsertBelow={() => accept('insert')}
              onDiscard={() => {
                ai.reset();
                editorRef.current?.focus();
              }}
              onRetry={() => {
                if (ai.state.status === 'idle') return;
                const { action, range, source } = ai.state;
                void ai.start(action, { ...range, text: source });
              }}
            />
          )}

          <NoteEditor
            key={active.id}
            ref={editorRef}
            content={active.html}
            editable={!pending}
            onChange={(html) => saveHtml(active.id, html)}
            onAiAction={(action, selection) => void ai.start(action, selection)}
          />
        </div>
      </section>
    </div>
  );
}
