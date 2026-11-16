import { describe, expect, it } from 'vitest';
import { nextAnnouncement, speakableText } from './announce';

describe('nextAnnouncement', () => {
  it('waits for a complete sentence', () => {
    expect(nextAnnouncement('Hello wor', 0)).toEqual({ chunk: '', end: 0 });
  });

  it('returns everything up to the last sentence boundary', () => {
    const text = 'One. Two! Three is still go';
    expect(nextAnnouncement(text, 0)).toEqual({ chunk: 'One. Two!', end: 9 });
  });

  it('continues from where the last announcement ended', () => {
    const text = 'One. Two. Three. Fo';
    const first = nextAnnouncement(text.slice(0, 6), 0);
    expect(first.chunk).toBe('One.');
    expect(nextAnnouncement(text, first.end).chunk).toBe(' Two. Three.');
  });

  it('treats newlines as boundaries (lists, headings)', () => {
    expect(nextAnnouncement('- item one\n- item tw', 0).chunk).toBe('- item one\n');
  });

  it('does not split on decimals', () => {
    expect(nextAnnouncement('Version 1.5 is out', 0).chunk).toBe('');
  });

  it('flushes the remainder when final', () => {
    expect(nextAnnouncement('Done. Tail', 6, true)).toEqual({ chunk: 'Tail', end: 10 });
  });
});

describe('speakableText', () => {
  it('strips Markdown syntax', () => {
    expect(speakableText('## Title\n\n- **bold** and `code`\n> quote')).toBe(
      'Title bold and code quote',
    );
  });

  it('summarises code blocks, including unfinished ones', () => {
    expect(speakableText('Run:\n```ts\nconst a = 1;\n```\nDone.')).toBe('Run: Code block. Done.');
    expect(speakableText('Run:\n```ts\nconst a')).toBe('Run: Code block.');
  });

  it('keeps link text only', () => {
    expect(speakableText('See [the docs](https://example.com).')).toBe('See the docs.');
  });

  it('drops table separator rows and pipes', () => {
    expect(speakableText('| A | B |\n| --- | --- |\n| 1 | 2 |')).toBe('A B 1 2');
  });
});
