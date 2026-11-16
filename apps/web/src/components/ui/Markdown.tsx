import { clsx } from 'clsx';
import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  // Wide tables scroll inside the bubble instead of overflowing the layout.
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
};

/**
 * Renders model output as GitHub-flavoured Markdown.
 *
 * Safe by default: react-markdown builds React elements from a syntax tree and
 * never uses dangerouslySetInnerHTML, and raw HTML in the Markdown is ignored,
 * so a model (or a prompt-injected page it quotes) cannot inject script.
 *
 * Partial Markdown while streaming (e.g. an unclosed code fence) just renders
 * as the parser sees it at that moment and settles once the text completes.
 */
export const Markdown = memo(function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'prose prose-sm max-w-none dark:prose-invert',
        'prose-pre:rounded-lg prose-pre:bg-surface-3 prose-pre:text-fg',
        'prose-code:before:content-none prose-code:after:content-none',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
});
