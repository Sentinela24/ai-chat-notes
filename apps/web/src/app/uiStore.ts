import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type View = 'chat' | 'notes';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface UiState {
  view: View;
  toast: Toast | null;
  setView(view: View): void;
  showToast(toast: Omit<Toast, 'id'>): void;
  dismissToast(id?: number): void;
}

let toastId = 0;

/** UI-only state (which view is open, the current toast). Server data never lives here. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      view: 'chat',
      toast: null,
      setView: (view) => set({ view }),
      showToast: (toast) => set({ toast: { ...toast, id: ++toastId } }),
      dismissToast: (id) =>
        set((s) => (id === undefined || s.toast?.id === id ? { toast: null } : s)),
    }),
    {
      name: 'acn:ui',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ view: s.view }),
    },
  ),
);
