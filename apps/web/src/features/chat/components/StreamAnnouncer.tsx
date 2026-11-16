import { useEffect, useRef, useState } from 'react';
import { nextAnnouncement, speakableText } from '@/lib/a11y/announce';
import type { Message } from '../types';

const THROTTLE_MS = 1500;

/**
 * Screen-reader narration for the streaming reply.
 *
 * A visually hidden, always-mounted polite live region. It announces
 * "Assistant is responding", then whole sentences in batches at most every
 * 1.5s (so the reader isn't interrupted mid-word), then the rest of the text
 * and the outcome (complete / stopped / error). The visible message itself is
 * marked aria-busy while streaming and is *not* a live region.
 */
export function StreamAnnouncer({ message }: { message: Message | undefined }) {
  const [announcement, setAnnouncement] = useState('');
  const state = useRef({ id: '', offset: 0, pending: '', lastFlush: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!message || message.role !== 'assistant') return;
    const s = state.current;
    const say = (text: string) => {
      s.lastFlush = Date.now();
      setAnnouncement(text);
    };

    // A new reply started.
    if (s.id !== message.id) {
      clearTimeout(timer.current);
      state.current = { id: message.id, offset: 0, pending: '', lastFlush: 0 };
      if (message.status === 'streaming') say('Assistant is responding.');
      return;
    }

    if (message.status === 'streaming') {
      const { chunk, end } = nextAnnouncement(message.content, s.offset);
      if (!chunk) return;
      s.offset = end;
      s.pending += chunk;
      const flush = () => {
        const text = speakableText(s.pending);
        s.pending = '';
        if (text) say(text);
      };
      const wait = THROTTLE_MS - (Date.now() - s.lastFlush);
      clearTimeout(timer.current);
      if (wait <= 0) flush();
      else timer.current = setTimeout(flush, wait);
      return;
    }

    // Finished: say whatever hasn't been said yet, then the outcome.
    clearTimeout(timer.current);
    const rest = s.pending + nextAnnouncement(message.content, s.offset, true).chunk;
    s.pending = '';
    s.offset = message.content.length;
    const outcome =
      message.status === 'error'
        ? `Error: ${message.error?.message ?? 'the reply failed.'}`
        : message.status === 'stopped'
          ? 'Response stopped.'
          : message.stopReason === 'refusal'
            ? 'The model declined to answer.'
            : 'Response complete.';
    say(`${speakableText(rest)} ${outcome}`.trim());
  }, [message]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}
