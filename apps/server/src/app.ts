import { Hono } from 'hono';

/** Builds the Hono app. Kept separate from `index.ts` so tests can call `app.request()` without a port. */
export function createApp() {
  const app = new Hono().basePath('/api');

  app.get('/health', (c) => c.json({ ok: true }));

  return app;
}
