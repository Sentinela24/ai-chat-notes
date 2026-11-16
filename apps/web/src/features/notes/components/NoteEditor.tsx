import type { TransformAction } from '@acn/shared';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code2,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Toolbar, type ToolbarItem } from '@/components/ui/Toolbar';

export interface SelectionInfo {
  from: number;
  to: number;
  text: string;
}

export interface NoteEditorHandle {
  focus(): void;
  /** Replace a range with HTML, as one undoable transaction. */
  replaceRange(range: { from: number; to: number }, html: string): void;
  /** Insert HTML as new blocks after the block that contains `pos`. */
  insertAfter(pos: number, html: string): void;
}

export interface NoteEditorProps {
  /** Initial HTML. The editor owns the document after mount (remount with a `key` to load another note). */
  content: string;
  onChange?: (html: string) => void;
  /** Read-only while an AI suggestion is pending, so the selection range stays valid. */
  editable?: boolean;
  /** Called when the user asks the AI to summarise or rewrite the current selection. */
  onAiAction?: (action: TransformAction, selection: SelectionInfo) => void;
  /** Accessible name for the editing area. */
  label?: string;
  placeholder?: string;
}

const MIN_AI_SELECTION = 3;
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? 'Cmd' : 'Ctrl';

/**
 * Rich-text editor for notes (TipTap / ProseMirror).
 *
 * The parent talks to it through a small imperative handle (focus, replace,
 * insert) instead of controlling the document as a prop: re-serialising the
 * whole document on every keystroke would fight ProseMirror's own state and
 * break undo history and cursor position.
 */
export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  {
    content,
    onChange,
    editable = true,
    onAiAction,
    label = 'Note content',
    placeholder = 'Start writing, or save a chat reply here…',
  },
  ref,
) {
  // Keep the latest onChange without re-creating the editor (refs are updated after render, not during).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    // Only re-render React on the state we select below, not on every transaction.
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[50vh] px-1 py-2 focus:outline-none prose-code:before:content-none prose-code:after:content-none prose-pre:bg-surface-3 prose-pre:text-fg',
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current?.(editor.getHTML()),
  });

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  const ui = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const { from, to, empty } = e.state.selection;
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        h2: e.isActive('heading', { level: 2 }),
        bullet: e.isActive('bulletList'),
        ordered: e.isActive('orderedList'),
        quote: e.isActive('blockquote'),
        codeBlock: e.isActive('codeBlock'),
        canUseAi:
          !empty && e.state.doc.textBetween(from, to, ' ').trim().length >= MIN_AI_SELECTION,
      };
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor.commands.focus(),
      replaceRange: (range, html) => {
        editor.chain().focus().insertContentAt(range, html).run();
      },
      insertAfter: (pos, html) => {
        const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size));
        // After the top-level block containing pos, so a summary never splits a paragraph.
        const after = $pos.depth > 0 ? $pos.after(1) : $pos.pos;
        editor.chain().focus().insertContentAt(after, html).run();
      },
    }),
    [editor],
  );

  const runAi = (action: TransformAction) => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '\n\n');
    onAiAction?.(action, { from, to, text });
  };

  const chain = () => editor.chain().focus();
  const locked = !editable;

  const items: ToolbarItem[] = [
    {
      id: 'bold',
      label: 'Bold',
      icon: <Bold className="size-4" aria-hidden />,
      shortcut: `${mod}+B`,
      pressed: ui?.bold,
      disabled: locked,
      onClick: () => chain().toggleBold().run(),
    },
    {
      id: 'italic',
      label: 'Italic',
      icon: <Italic className="size-4" aria-hidden />,
      shortcut: `${mod}+I`,
      pressed: ui?.italic,
      disabled: locked,
      onClick: () => chain().toggleItalic().run(),
    },
    {
      id: 'h2',
      label: 'Heading',
      icon: <Heading2 className="size-4" aria-hidden />,
      pressed: ui?.h2,
      disabled: locked,
      groupStart: true,
      onClick: () => chain().toggleHeading({ level: 2 }).run(),
    },
    {
      id: 'bullet',
      label: 'Bulleted list',
      icon: <List className="size-4" aria-hidden />,
      pressed: ui?.bullet,
      disabled: locked,
      onClick: () => chain().toggleBulletList().run(),
    },
    {
      id: 'ordered',
      label: 'Numbered list',
      icon: <ListOrdered className="size-4" aria-hidden />,
      pressed: ui?.ordered,
      disabled: locked,
      onClick: () => chain().toggleOrderedList().run(),
    },
    {
      id: 'quote',
      label: 'Quote',
      icon: <Quote className="size-4" aria-hidden />,
      pressed: ui?.quote,
      disabled: locked,
      onClick: () => chain().toggleBlockquote().run(),
    },
    {
      id: 'code',
      label: 'Code block',
      icon: <Code2 className="size-4" aria-hidden />,
      pressed: ui?.codeBlock,
      disabled: locked,
      onClick: () => chain().toggleCodeBlock().run(),
    },
  ];

  if (onAiAction) {
    items.push(
      {
        id: 'summarise',
        label: 'Summarise',
        showLabel: true,
        icon: <Sparkles className="size-4" aria-hidden />,
        disabled: locked || !ui?.canUseAi,
        groupStart: true,
        onClick: () => runAi('summarise'),
      },
      {
        id: 'rewrite',
        label: 'Rewrite',
        showLabel: true,
        icon: <WandSparkles className="size-4" aria-hidden />,
        disabled: locked || !ui?.canUseAi,
        onClick: () => runAi('rewrite'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-0 z-10 -mx-1 border-b border-border bg-surface/95 px-1 py-1 backdrop-blur">
        <Toolbar label="Formatting" items={items} />
        {onAiAction && !locked && !ui?.canUseAi && (
          <p className="px-1 pt-1 text-xs text-muted">
            Select some text to summarise or rewrite it.
          </p>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
});
