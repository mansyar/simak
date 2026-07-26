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

  test('invalid login credentials show inline error', async ({ page, context }) => {
    // Clear cookies to simulate unauthenticated state
    await context.clearCookies();

    // Navigate to login page
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // Fill in valid email but wrong password
    await page.fill('#email', 'student@e2e.test');
    await page.fill('#password', 'WrongPassword123!');

    // Submit the form via requestSubmit (Base UI Button defaults to type=button)
    await page.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());

    // Verify inline error message appears
    await expect(page.locator('#login-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#login-error')).toContainText(/invalid email or password/i);
  });
});
