import type { Preview } from '@storybook/react-vite';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    // Runs axe on every story in the Accessibility panel.
    a11y: { test: 'todo' },
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl bg-surface text-fg">
        <Story />
      </div>
    ),
  ],
};

export default preview;
