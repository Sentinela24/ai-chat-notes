import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useUiStore } from '@/app/uiStore';
import { IconButton } from './ui/Button';

const TOAST_MS = 6000;

/**
 * One toast at a time, announced politely via role="status". The live region
 * is always in the DOM (only its content changes), which screen readers need
 * to reliably pick up the announcement.
 */
export function Toaster() {
  const toast = useUiStore((s) => s.toast);
  const dismiss = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dismiss(toast.id), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-14 z-50 flex justify-center px-4 md:justify-end"
    >
      {toast && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-surface-2 py-2 pr-2 pl-4 text-sm shadow-lg">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="rounded-md px-2 py-1 font-medium text-accent hover:bg-surface-3"
              onClick={() => {
                toast.action?.onClick();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <IconButton
            label="Dismiss notification"
            icon={<X className="size-4" aria-hidden />}
            onClick={() => dismiss(toast.id)}
          />
        </div>
      )}
    </div>
  );
}
