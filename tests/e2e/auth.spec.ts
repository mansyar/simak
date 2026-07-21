import { test, expect } from '@playwright/test';
import { resetDatabase } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

test.describe('Authentication & Route Guards', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'student');
  });

  test.use({ storageState: getAuthFilePath('student') });

  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/student/assignments');

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('#email')).toBeVisible();

    await context.close();
  });

  test('student accessing admin route is redirected to student dashboard', async ({ page }) => {
    await page.goto('/admin/users');

    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test('valid login redirects to role-specific dashboard', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/auth/login');

    await page.fill('#email', 'student@e2e.test');
    await page.fill('#password', 'TestPass123!');
    await page.click('button[type=submit]');

    await expect(page).toHaveURL(/\/student\/dashboard/);

    await context.close();
  });
});
