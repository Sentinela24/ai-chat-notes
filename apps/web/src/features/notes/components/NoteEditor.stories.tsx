import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { markdownToHtml } from '@/lib/markdown';
import { SAMPLE_REPLY } from '@/stories/useFakeStream';
import { NoteEditor } from './NoteEditor';

const meta = {
  title: 'Notes/NoteEditor',
  component: NoteEditor,
  args: {
    content: '',
    onChange: fn(),
    onAiAction: fn(),
    editable: true,
  },
} satisfies Meta<typeof NoteEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

/** A chat reply saved as a note (Markdown converted to rich text). Select text to enable Summarise / Rewrite. */
export const FromChatReply: Story = {
  args: { content: markdownToHtml(SAMPLE_REPLY) },
};

/** Read-only while an AI suggestion is pending, so the selected range stays valid. */
export const LockedForAiSuggestion: Story = {
  args: { content: markdownToHtml(SAMPLE_REPLY), editable: false },
};

export const WithoutAiActions: Story = {
  args: { content: markdownToHtml(SAMPLE_REPLY), onAiAction: undefined },
};
