import { test, expect, type Page } from '@playwright/test';
import { loginAsRole } from './helpers/auth';

function captureHydrationMessages(page: Page): string[] {
  const messages: string[] = [];
  const pattern = /hydration|hydrated|server-rendered html|some attributes.*didn't match/i;

  page.on('console', (message) => {
    if (pattern.test(message.text())) {
      messages.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    if (pattern.test(error.message)) {
      messages.push(error.message);
    }
  });

  return messages;
}

async function expectStableHydration(page: Page, messages: string[]) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const script = Array.from(document.scripts).find((candidate) =>
          candidate.textContent?.includes('simak-theme'),
        );
        return script?.nonce ?? '';
      }),
    )
    .toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  expect(messages).toEqual([]);
}

test.describe('SSR hydration stability', () => {
  test('public landing page has no hydration or nonce mismatch', async ({ page }) => {
    const messages = captureHydrationMessages(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expectStableHydration(page, messages);
  });

  test('authenticated dashboard has no hydration or nonce mismatch', async ({ page }) => {
    const messages = captureHydrationMessages(page);

    await loginAsRole(page, 'student');

    await expectStableHydration(page, messages);
  });
});
