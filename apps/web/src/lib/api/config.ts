import { ConfigResponseSchema, type ConfigResponse } from '@acn/shared';
import { useQuery } from '@tanstack/react-query';

export async function fetchConfig(signal?: AbortSignal): Promise<ConfigResponse> {
  const res = await fetch('/api/config', { signal });
  if (!res.ok) throw new Error(`Config request failed (${res.status})`);
  return ConfigResponseSchema.parse(await res.json());
}

/**
 * Which provider/model the server is using.
 *
 * This is classic request/response server state, which is what TanStack Query
 * is for: caching, de-duplication, retries and background refetching. The
 * streamed chat itself is not a good fit for useQuery (it's a long-lived,
 * cancellable, incrementally-updating write), so it lives in chatActions +
 * Zustand instead.
 */
export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: ({ signal }) => fetchConfig(signal),
    staleTime: 60_000,
  });
}
