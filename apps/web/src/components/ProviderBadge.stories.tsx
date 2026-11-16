import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProviderBadgeView } from './ProviderBadge';

const meta = {
  title: 'App/ProviderBadge',
  component: ProviderBadgeView,
  args: { status: 'success' },
} satisfies Meta<typeof ProviderBadgeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mock: Story = {
  args: { config: { provider: 'mock', model: 'mock-1', mock: true } },
};

export const Anthropic: Story = {
  args: { config: { provider: 'anthropic', model: 'claude-opus-5-5', mock: false } },
};

export const Connecting: Story = { args: { status: 'pending' } };

export const Offline: Story = { args: { status: 'error' } };
