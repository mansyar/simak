import { test, expect } from '@playwright/test';
import { resetDatabase } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath, ROLE_CREDENTIALS } from './helpers/auth';

test.describe('Settings Hub', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'admin');
  });

  test.use({ storageState: getAuthFilePath('admin') });

  test('profile name edit persists after reload', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('#profile-name');
    await expect(nameInput).toBeVisible();
    await nameInput.clear();
    await nameInput.fill('Admin Edited Name');

    await page.getByRole('button', { name: 'Save Name' }).click();

    await expect(page.getByText('Name updated successfully')).toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#profile-name')).toHaveValue('Admin Edited Name');
  });

  test('password change works with new password', async ({ page, browser }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Current Password', { exact: true }).fill('TestPass123!');
    await page.getByLabel('New Password', { exact: true }).fill('NewTestPass123!');
    await page.getByLabel('Confirm New Password', { exact: true }).fill('NewTestPass123!');

    const passwordForm = page.locator('form').filter({ hasText: 'Change Password' }).first();
    await passwordForm.evaluate((form) => (form as HTMLFormElement).requestSubmit());

    await expect(page.getByText('Password changed successfully')).toBeVisible({ timeout: 10000 });

    // Verify in a new context (no session cookie)
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    await newPage.goto('http://localhost:3000/auth/login');
    await newPage.waitForLoadState('networkidle');

    // Old password should fail
    const oldResult = await newPage.evaluate(
      async (creds) => {
        const res = await fetch('/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creds),
        });
        const body = await res.json().catch(() => null);
        return { status: res.status, hasError: !!body?.error };
      },
      { email: ROLE_CREDENTIALS.admin.email, password: 'TestPass123!' },
    );
    expect(oldResult.hasError || oldResult.status !== 200).toBeTruthy();

    // New password should succeed
    const newResult = await newPage.evaluate(
      async (creds) => {
        const res = await fetch('/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creds),
        });
        const body = await res.json().catch(() => null);
        return { status: res.status, hasError: !!body?.error };
      },
      { email: ROLE_CREDENTIALS.admin.email, password: 'NewTestPass123!' },
    );
    expect(newResult.status).toBe(200);
    expect(newResult.hasError).toBeFalsy();

    await newContext.close();
  });

  test('language toggle from EN to ID changes UI text', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Appearance', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'ID', exact: true }).click();

    await expect(page.getByText('Tampilan', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('theme toggle applies dark class to html', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    const initialDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );

    await page.getByRole('button', { name: 'Toggle theme' }).click();

    const afterToggle = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(afterToggle).toBe(!initialDark);
  });

  test('notification preferences toggle persists after reload', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    const emailCheckbox = page.locator('#notif-review_completed-email');
    await expect(emailCheckbox).toBeVisible();
    await expect(emailCheckbox).toBeChecked();

    // Click to toggle (controlled component — state updates after mutation refetch)
    await emailCheckbox.click();
    await page.waitForTimeout(2000);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#notif-review_completed-email')).not.toBeChecked();
  });
});
