import { test, expect } from '@playwright/test';
import { resetDatabase } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath, loginAsRole } from './helpers/auth';

test.describe('Authentication & Route Guards', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'student');
  });

  test.use({ storageState: getAuthFilePath('student') });

  test('unauthenticated user is redirected to login', async ({ page, context }) => {
    // Clear cookies to simulate unauthenticated state
    await context.clearCookies();

    await page.goto('/student/assignments');

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('student accessing admin route is redirected to student dashboard', async ({ page }) => {
    await page.goto('/admin/users');

    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test('valid login redirects to role-specific dashboard', async ({ page, context }) => {
    // Clear cookies to simulate unauthenticated state
    await context.clearCookies();

    // Login via the login form (fills form fields, submits via API due to Base UI Button issue)
    await loginAsRole(page, 'student');

    await expect(page).toHaveURL(/\/student\/dashboard/);
  });
});
