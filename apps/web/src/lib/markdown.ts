import { marked } from 'marked';

/**
 * Converts model Markdown into HTML for the TipTap editor.
 *
 * Safe to feed into the editor even though `marked` passes raw HTML through:
 * TipTap parses HTML with DOMParser (which never runs scripts) and then keeps
 * only nodes and marks that exist in the editor schema. A <script>, <iframe>
 * or onclick attribute simply doesn't survive the parse.
 */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false, gfm: true, breaks: false });
}

/** A short plain-text title from the first meaningful line of some Markdown. */
export function titleFromMarkdown(markdown: string, max = 60): string {
  const line =
    markdown
      .split('\n')
      .map((l) =>
        l
          .replace(/^\s{0,3}(#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/, '')
          .replace(/[*_`~[\]]/g, '')
          .trim(),
      )
      .find((l) => l.length > 0 && !/^(\||-{3,})/.test(l)) ?? '';
  if (!line) return 'Untitled note';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
