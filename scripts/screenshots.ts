/**
 * Regenerates the README screenshots against a running dev stack in mock mode.
 *
 *   npm run dev            # in one terminal (LLM_PROVIDER=mock)
 *   npm run screenshots    # in another
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  colorScheme: 'dark',
  deviceScaleFactor: 2,
});

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();

// Chat: one finished reply, one streaming.
const input = page.getByRole('textbox', { name: 'Message' });
await input.fill('Why is SSE a good fit for streaming LLM replies?');
await input.press('Enter');
await page
  .getByRole('article', { name: 'Assistant replied' })
  .last()
  .and(page.locator('[aria-busy="false"]'))
  .waitFor({ timeout: 15_000 });
await page.screenshot({ path: 'docs/screenshot-chat.png' });

// Notes: save the reply, open it, and show a rewrite suggestion.
await page.getByRole('button', { name: 'Save to notes' }).click();
await page.getByRole('button', { name: 'Open' }).click();
const editor = page.getByRole('textbox', { name: 'Note content' });
await editor.locator('p').nth(1).click({ clickCount: 3 });
await page.getByRole('button', { name: 'Rewrite' }).click();
await page.getByRole('region', { name: 'AI suggestion' }).getByText('Suggestion ready').waitFor();
await page.screenshot({ path: 'docs/screenshot-notes.png' });

await browser.close();
console.log('Saved docs/screenshot-chat.png and docs/screenshot-notes.png');
