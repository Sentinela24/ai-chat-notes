import { ChatView } from '@/features/chat/components/ChatView';

export function App() {
  return (
    <div className="flex h-dvh flex-col bg-surface text-fg">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border px-4">
        <h1 className="text-sm font-semibold">AI Chat + Notes</h1>
      </header>
      <main className="min-h-0 flex-1">
        <ChatView />
      </main>
    </div>
  );
}
