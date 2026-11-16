import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createProvider } from './providers';

const port = Number(process.env.PORT ?? 8787);
const provider = createProvider(process.env);
const app = createApp({ provider });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port}`);
  console.log(`[server] provider: ${provider.name} (${provider.model})`);
});
