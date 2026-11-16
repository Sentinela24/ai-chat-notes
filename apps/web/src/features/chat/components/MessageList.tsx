import { ArrowDown } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

const STICK_THRESHOLD_PX = 80;

/**
 * Scroll container that follows a streaming reply only while the user is at
 * the bottom. If they scroll up to read something, new tokens don't yank them
 * back down; a "Jump to latest" button appears instead.
 */
export function MessageList({
  children,
  /** Changes whenever content grows (e.g. message count + last message length). */
  contentKey,
}: {
  children: ReactNode;
  contentKey: string | number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    stickRef.current = true;
    setShowJump(false);
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    stickRef.current = atBottom;
    setShowJump(!atBottom);
  };

  // Layout effect: scroll before paint, so there's no one-frame jump.
  useLayoutEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [contentKey, scrollToBottom]);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto" tabIndex={-1}>
        {children}
      </div>
      {showJump && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            size="sm"
            className="pointer-events-auto rounded-full shadow-md"
            icon={<ArrowDown className="size-3.5" aria-hidden />}
            onClick={() =>
              scrollToBottom(
                window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              )
            }
          >
            Jump to latest
          </Button>
        </div>
      )}
    </div>
  );
}
