import { test, expect } from '@playwright/test';
import { resetDatabase } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

test.describe('Admin User Management', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'admin');
  });

  test.use({ storageState: getAuthFilePath('admin') });

  test('admin creates an instructor account', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Click "New User" button
    await page.getByRole('button', { name: 'New User' }).click();

    // Wait for dialog to appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill the create user form
    await dialog.locator('input[name="name"]').fill('New Instructor');
    await dialog.locator('input[name="email"]').fill('new-instructor@e2e.test');

    // Select role "Instructor" from the dropdown
    await dialog.locator('button[role="combobox"]').click();
    await page.getByRole('option', { name: 'Instructor' }).click();

    // Submit the form via requestSubmit (Base UI Button defaults to type=button)
    await dialog.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());

    // Wait for the dialog to close and the user list to update
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Verify the new user appears in the user list table
    await expect(page.locator('table')).toContainText('new-instructor@e2e.test', {
      timeout: 10_000,
    });
  });

  test('admin creates a student account', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Click "New User" button
    await page.getByRole('button', { name: 'New User' }).click();

    // Wait for dialog to appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill the create user form (default role is "Student")
    await dialog.locator('input[name="name"]').fill('New Student');
    await dialog.locator('input[name="email"]').fill('new-student@e2e.test');

    // Submit the form via requestSubmit (Base UI Button defaults to type=button)
    await dialog.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());

    // Wait for the dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Verify the new user appears in the user list table
    await expect(page.locator('table')).toContainText('new-student@e2e.test', {
      timeout: 10_000,
    });
  });

  test('admin filters users by role', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Filter by "Instructor" role via URL (same as selecting from combobox)
    await page.goto('/admin/users?role=instructor');
    await page.waitForLoadState('networkidle');

    // Verify instructor@e2e.test is visible in the table
    await expect(page.locator('table')).toContainText('instructor@e2e.test', {
      timeout: 10_000,
    });

    // Verify admin@e2e.test is NOT visible in the table (filtered out)
    // Scoped to table to avoid matching the sidebar user profile
    await expect(page.locator('table')).not.toContainText('admin@e2e.test', {
      timeout: 5_000,
    });
  });

  test('create-user dialog shows Admin, Instructor, Student roles but not Super Admin', async ({
    page,
  }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Click "New User" button
    await page.getByRole('button', { name: 'New User' }).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Open the role dropdown
    await dialog.locator('button[role="combobox"]').click();

    // Verify Admin, Instructor, Student are available
    await expect(page.getByRole('option', { name: 'Admin' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('option', { name: 'Instructor' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('option', { name: 'Student' })).toBeVisible({ timeout: 5_000 });

    // Verify Super Admin is NOT available
    await expect(page.getByRole('option', { name: 'Super Admin' })).not.toBeVisible();

    // Close dialog by pressing Escape
    await page.keyboard.press('Escape');
  });
});
