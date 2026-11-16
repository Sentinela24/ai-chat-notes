/**
 * Helpers for announcing streamed text to screen readers.
 *
 * Putting the streaming message itself in an aria-live region would make a
 * screen reader try to read every token as it arrives (or re-read the whole
 * message on every update, depending on the reader). Instead we announce
 * complete sentences, in batches, through a separate polite live region.
 */

const SENTENCE_END = /[.!?](?=\s)|\n/g;

/**
 * Returns the not-yet-announced text up to the last sentence boundary.
 * With `final`, returns everything that's left.
 */
export function nextAnnouncement(
  text: string,
  from: number,
  final = false,
): { chunk: string; end: number } {
  const rest = text.slice(from);
  if (final) return { chunk: rest, end: text.length };
  let last = -1;
  for (const m of rest.matchAll(SENTENCE_END)) last = m.index + m[0].length;
  if (last === -1) return { chunk: '', end: from };
  return { chunk: rest.slice(0, last), end: from + last };
}

/** Makes Markdown pleasant to hear: no asterisks, pipes or hashes read aloud, code blocks summarised. */
export function speakableText(markdown: string): string {
  return (
    markdown
      // Whole fenced code blocks (complete or still streaming) become a short cue.
      .replace(/```[\s\S]*?(```|$)/g, ' Code block. ')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s*([-*+]|\d+\.)\s+/gm, '')
      .replace(/[*_`~|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
