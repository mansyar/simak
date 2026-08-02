import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath, ROLE_CREDENTIALS } from './helpers/auth';

test.describe('Student timezone and calendar feed', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    await resetDatabase();
    await ensureAuthFile(browser, 'student');
  });

  test.use({ storageState: getAuthFilePath('student') });

  test('detects and overrides timezone, displays a DST deadline, and manages the feed lifecycle', async ({
    browser,
  }) => {
    const sql = postgres(getDatabaseUrl());
    const [fixture] = await sql`
      SELECT c.id AS checkpoint_id, c.assignment_id
      FROM checkpoints c
      JOIN users u ON c.student_id = u.id
      JOIN assignments a ON c.assignment_id = a.id
      WHERE u.email = 'student@e2e.test' AND a.deleted_at IS NULL
      LIMIT 1
    `;
    if (!fixture) throw new Error('Expected a seeded student checkpoint fixture.');

    await sql`
      UPDATE checkpoints
      SET due_date = '2026-03-08T10:30:00.000Z', state = 'unlocked'
      WHERE id = ${fixture.checkpoint_id}
    `;
    await sql`
      UPDATE assignments
      SET final_deadline = '2026-03-08T12:00:00.000Z'
      WHERE id = ${fixture.assignment_id}
    `;
    await sql.end();

    const context = await browser.newContext({
      storageState: getAuthFilePath('student'),
      timezoneId: 'America/Los_Angeles',
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();

    try {
      await page.goto('/student/settings');
      await page.waitForLoadState('networkidle');
      const timezoneInput = page.getByLabel('IANA timezone', { exact: true });
      await expect(timezoneInput).toHaveValue('America/Los_Angeles');
      await expect(page.getByText('Private calendar feed', { exact: true })).toBeVisible();

      await timezoneInput.fill('America/New_York');
      await page.getByRole('button', { name: 'Save timezone', exact: true }).click();
      await expect(page.getByText('Timezone saved successfully.')).toBeVisible();

      await page.goto('/student/dashboard');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).toContainText('Mar 8, 2026');

      await page.goto('/student/settings');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: 'Enable calendar feed', exact: true }).click();
      const feedInput = page.getByLabel('Private calendar URL', { exact: true });
      await expect(feedInput).toBeVisible();
      const firstUrl = await feedInput.inputValue();

      await page.getByRole('button', { name: 'Copy URL', exact: true }).click();
      await expect(page.getByText('Calendar URL copied.')).toBeVisible();

      const firstResponse = await page.request.get(firstUrl);
      expect(firstResponse.status()).toBe(200);
      expect(firstResponse.headers()['content-type']).toContain('text/calendar');
      expect(firstResponse.headers()['cache-control']).toContain('private');
      expect(firstResponse.headers()['cache-control']).toContain('no-store');
      expect(firstResponse.headers()['referrer-policy']).toBe('no-referrer');
      expect(firstResponse.headers()['x-content-type-options']).toBe('nosniff');
      const firstBody = await firstResponse.text();
      expect(firstBody).toContain('DTSTART:20260308T103000Z');
      expect(firstBody).not.toContain(firstUrl.split('token=')[1]);

      await page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Regenerate URL', exact: true }).click();
      await expect(feedInput).not.toHaveValue(firstUrl);
      const secondUrl = await feedInput.inputValue();
      expect(secondUrl).not.toBe(firstUrl);
      expect((await page.request.get(firstUrl)).status()).toBe(401);
      expect((await page.request.get(secondUrl)).status()).toBe(200);

      await page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Disable calendar feed', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Enable calendar feed', exact: true }),
      ).toBeVisible();
      expect((await page.request.get(secondUrl)).status()).toBe(401);
    } finally {
      await context.close();
    }
  });

  test('does not expose student timezone or feed controls to instructors', async ({ page }) => {
    const credentials = ROLE_CREDENTIALS.instructor;
    await page.context().clearCookies();
    await page.goto('/auth/login');
    await page.fill('#email', credentials.email);
    await page.fill('#password', credentials.password);
    const response = await page.evaluate(async (loginCredentials) => {
      const result = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginCredentials),
      });
      return { ok: result.ok, status: result.status };
    }, credentials);
    expect(response.ok, `Instructor login failed with ${response.status}`).toBe(true);
    await page.goto('/instructor/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Student deadline timezone', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Private calendar feed', { exact: true })).toHaveCount(0);
  });
});
