import { ArrowUp, Square } from 'lucide-react';
import { forwardRef, useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { IconButton } from '@/components/ui/Button';

export interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
  /** Initial draft (for Storybook / tests). */
  defaultValue?: string;
}

/**
 * The message input.
 *
 * - Enter sends, Shift+Enter inserts a newline (and Enter during IME
 *   composition, e.g. Japanese input, never sends).
 * - The textarea stays enabled while a reply streams, so you can draft the
 *   next message; the send button becomes a Stop button and Enter does nothing.
 * - Grows with its content (CSS `field-sizing: content`) up to a max height.
 */
export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { onSend, onStop, isStreaming, placeholder = 'Message the assistant…', defaultValue = '' },
  ref,
) {
  const [value, setValue] = useState(defaultValue);
  const hintId = useId();
  const canSend = value.trim().length > 0 && !isStreaming;

  const submit = () => {
    if (!canSend) return;
    onSend(value);
    setValue('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isStreaming) onStop();
    else submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm focus-within:border-accent"
    >
      <label htmlFor={`${hintId}-input`} className="sr-only">
        Message
      </label>
      <textarea
        ref={ref}
        id={`${hintId}-input`}
        aria-describedby={hintId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        className="max-h-48 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] [field-sizing:content] placeholder:text-muted focus:outline-none"
      />
      <span id={hintId} className="sr-only">
        Press Enter to send, Shift+Enter for a new line
        {isStreaming ? ', Escape to stop the current reply' : ''}.
      </span>
      {/* Distinct keys: without them React reuses one <button> for both, and focus
          would stay on a now-disabled "Send" after stopping. */}
      {isStreaming ? (
        <IconButton
          key="stop"
          type="submit"
          variant="secondary"
          size="md"
          label="Stop generating"
          icon={<Square className="size-4 fill-current" aria-hidden />}
          className="rounded-xl"
        />
      ) : (
        <IconButton
          key="send"
          type="submit"
          variant="primary"
          size="md"
          label="Send message"
          icon={<ArrowUp className="size-5" aria-hidden />}
          disabled={!canSend}
          className="rounded-xl"
        />
      )}
    </form>
  );
});
