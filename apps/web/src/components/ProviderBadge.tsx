import type { ConfigResponse } from '@acn/shared';
import { clsx } from 'clsx';
import { useConfig } from '@/lib/api/config';

const PROVIDER_LABEL: Record<ConfigResponse['provider'], string> = {
  mock: 'Mock mode',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

/** Presentational badge (used directly in Storybook). */
export function ProviderBadgeView({
  config,
  status,
}: {
  config?: ConfigResponse;
  status: 'pending' | 'error' | 'success';
}) {
  const label =
    status === 'pending'
      ? 'Connecting…'
      : status === 'error' || !config
        ? 'Server offline'
        : config.mock
          ? PROVIDER_LABEL.mock
          : `${PROVIDER_LABEL[config.provider]} · ${config.model}`;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs',
        status === 'error'
          ? 'border-danger/40 text-danger'
          : config?.mock
            ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
            : 'border-border text-muted',
      )}
      title={
        config?.mock
          ? 'Replies are generated locally by the mock provider. No API key in use.'
          : undefined
      }
    >
      <span
        aria-hidden
        className={clsx(
          'size-1.5 rounded-full',
          status === 'success' ? 'bg-emerald-500' : status === 'error' ? 'bg-danger' : 'bg-muted',
        )}
      />
      {label}
    </span>
  );
}

export function ProviderBadge() {
  const { data, status } = useConfig();
  return <ProviderBadgeView config={data} status={status} />;
}
