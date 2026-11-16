import { describe, expect, it } from 'vitest';
import { markdownToHtml, titleFromMarkdown } from './markdown';

describe('markdownToHtml', () => {
  it('converts GFM to HTML', () => {
    expect(markdownToHtml('**bold** and `code`')).toBe(
      '<p><strong>bold</strong> and <code>code</code></p>\n',
    );
  });
});

describe('titleFromMarkdown', () => {
  it('uses the first line without Markdown syntax', () => {
    expect(titleFromMarkdown('## Hello **world**\n\nBody')).toBe('Hello world');
    expect(titleFromMarkdown('\n\n- first item\n- second')).toBe('first item');
  });

  it('truncates long titles', () => {
    expect(titleFromMarkdown('a'.repeat(100), 10)).toBe('aaaaaaaaa…');
  });

  it('falls back when there is no text', () => {
    expect(titleFromMarkdown('   ')).toBe('Untitled note');
  });
});
