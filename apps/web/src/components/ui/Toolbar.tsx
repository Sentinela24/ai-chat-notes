import { clsx } from 'clsx';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface ToolbarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Show the label as text next to the icon (otherwise icon-only with a tooltip). */
  showLabel?: boolean;
  onClick: () => void;
  /** For toggle buttons (bold, italic...): exposes aria-pressed. */
  pressed?: boolean;
  disabled?: boolean;
  /** Keyboard shortcut hint, e.g. "Ctrl+B". */
  shortcut?: string;
  /** Start a new visual group. */
  groupStart?: boolean;
}

/**
 * A WAI-ARIA toolbar with a roving tabindex: the whole toolbar is one Tab
 * stop, and arrow keys / Home / End move between buttons. This keeps keyboard
 * users from tabbing through ten formatting buttons to reach the editor.
 * https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
 */
export function Toolbar({ label, items }: { label: string; items: ToolbarItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
  // If the remembered item became disabled, fall back to the first enabled one.
  const tabStop = enabled.includes(activeIndex) ? activeIndex : (enabled[0] ?? -1);

  const focusItem = (index: number) => {
    setActiveIndex(index);
    refs.current[index]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const pos = enabled.indexOf(tabStop);
    if (pos === -1) return;
    let next: number | undefined;
    if (e.key === 'ArrowRight') next = enabled[(pos + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled.at(-1);
    if (next === undefined) return;
    e.preventDefault();
    focusItem(next);
  };

  return (
    <div
      role="toolbar"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-0.5"
    >
      {items.map((item, i) => (
        <span key={item.id} className="flex items-center">
          {item.groupStart && i > 0 && <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />}
          <button
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            tabIndex={i === tabStop ? 0 : -1}
            aria-label={item.showLabel ? undefined : item.label}
            aria-pressed={item.pressed}
            aria-keyshortcuts={item.shortcut}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            disabled={item.disabled}
            onFocus={() => setActiveIndex(i)}
            onClick={item.onClick}
            className={clsx(
              'inline-flex h-8 items-center gap-1.5 rounded-md text-sm transition-colors',
              item.showLabel ? 'px-2.5' : 'w-8 justify-center',
              item.pressed ? 'bg-surface-3 text-fg' : 'text-muted hover:bg-surface-3 hover:text-fg',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            {item.icon}
            {item.showLabel && item.label}
          </button>
        </span>
      ))}
    </div>
  );
}
