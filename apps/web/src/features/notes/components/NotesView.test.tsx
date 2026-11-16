import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/app/uiStore';
import { Toaster } from '@/components/Toaster';
import { useNotesStore } from '../store';
import { NotesView } from './NotesView';

beforeEach(() => {
  useNotesStore.setState({ notes: [], activeId: null });
  useUiStore.setState({ view: 'notes', toast: null });
});

describe('NotesView', () => {
  it('deletes a note and can undo it from the toast', async () => {
    useNotesStore.getState().createNote({ title: 'Groceries', html: '<p>Milk</p>' });
    render(
      <>
        <NotesView />
        <Toaster />
      </>,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete "Groceries"' }));
    expect(screen.getByText('No notes yet')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: /Groceries/, current: 'page' })).toBeInTheDocument();
  });
});
