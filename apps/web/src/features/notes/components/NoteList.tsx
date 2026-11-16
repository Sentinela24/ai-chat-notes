import { clsx } from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import type { Note } from '../store';

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export interface NoteListProps {
  notes: Note[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export function NoteList({
  notes,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  disabled,
}: NoteListProps) {
  return (
    <nav aria-label="Notes" className="flex min-h-0 flex-col gap-2">
      <Button
        size="sm"
        variant="secondary"
        icon={<Plus className="size-4" aria-hidden />}
        onClick={onCreate}
        disabled={disabled}
      >
        New note
      </Button>
      <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {notes.map((note) => {
          const active = note.id === activeId;
          return (
            <li key={note.id} className="group relative">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                disabled={disabled && !active}
                onClick={() => onSelect(note.id)}
                className={clsx(
                  'flex w-full flex-col items-start rounded-lg px-3 py-2 pr-9 text-left transition-colors',
                  active ? 'bg-surface-3' : 'hover:bg-surface-2',
                  'disabled:opacity-50',
                )}
              >
                <span className="w-full truncate text-sm font-medium">
                  {note.title || 'Untitled note'}
                </span>
                <span className="text-xs text-muted">{dateFmt.format(note.updatedAt)}</span>
              </button>
              <IconButton
                label={`Delete "${note.title || 'Untitled note'}"`}
                icon={<Trash2 className="size-3.5" aria-hidden />}
                disabled={disabled}
                onClick={() => onDelete(note.id)}
                className="absolute top-1.5 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
