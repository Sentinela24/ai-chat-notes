import { clsx } from 'clsx';
import { MessagesSquare, NotebookText } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ProviderBadge } from '@/components/ProviderBadge';
import { Toaster } from '@/components/Toaster';
import { ChatView } from '@/features/chat/components/ChatView';
import { NotesView } from '@/features/notes/components/NotesView';
import { saveReplyToNotes } from '@/features/notes/saveReply';
import { useUiStore, type View } from './uiStore';

const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'chat', label: 'Chat', icon: <MessagesSquare className="size-4" aria-hidden /> },
  { id: 'notes', label: 'Notes', icon: <NotebookText className="size-4" aria-hidden /> },
];

export function App() {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);

  // On a client-side view change, move focus to the new view's heading so
  // screen-reader and keyboard users land at the start of the new content
  // (what a full page load would do). Skipped on first render.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('view-heading')?.focus();
  }, [view]);

  return (
    <div className="flex h-dvh flex-col bg-surface text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        Skip to content
      </a>
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border px-4">
        <h1 className="text-sm font-semibold">AI Chat + Notes</h1>
        <nav aria-label="Views" className="flex items-center gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-current={view === v.id ? 'page' : undefined}
              onClick={() => setView(v.id)}
              className={clsx(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors',
                view === v.id ? 'bg-surface-3 font-medium text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto">
          <ProviderBadge />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="min-h-0 flex-1 focus:outline-none">
        {view === 'chat' ? <ChatView onSaveToNote={saveReplyToNotes} /> : <NotesView />}
      </main>
      <Toaster />
    </div>
  );
}
