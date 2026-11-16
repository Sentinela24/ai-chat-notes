import { defineConfig, devices } from '@playwright/test';

// Dedicated ports so E2E runs don't collide with `npm run dev`.
const API_PORT = 8790;
const WEB_PORT = 5180;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The whole stack runs in MOCK mode: deterministic replies, no API key, no network.
  webServer: [
    {
      command: 'npm run start -w apps/server',
      port: API_PORT,
      env: { LLM_PROVIDER: 'mock', MOCK_DELAY_MS: '15', PORT: String(API_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run dev -w apps/web -- --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      env: { API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
