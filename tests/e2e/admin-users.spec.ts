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

    // Click "New User" button to open the dialog
    await page.click('text=New User');

    // Fill the create user form
    await page.fill('input[name="name"]', 'New Instructor');
    await page.fill('input[name="email"]', 'new-instructor@e2e.test');

    // Select role "Instructor" from the dropdown
    await page.click('[role="dialog"] button[role="combobox"]');
    await page.click('text=Instructor');

    // Submit the form
    await page.click('[role="dialog"] button[type=submit]');

    // Wait for the dialog to close and the user list to update
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 });

    // Verify the new user appears in the user list
    await expect(page.locator('text=new-instructor@e2e.test')).toBeVisible({ timeout: 10_000 });
  });

  test('admin creates a student account', async ({ page }) => {
    await page.goto('/admin/users');

    await page.click('text=New User');

    await page.fill('input[name="name"]', 'New Student');
    await page.fill('input[name="email"]', 'new-student@e2e.test');

    // Default role is "Student", so we just submit
    await page.click('[role="dialog"] button[type=submit]');

    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 });

    await expect(page.locator('text=new-student@e2e.test')).toBeVisible({ timeout: 10_000 });
  });

  test('admin filters users by role', async ({ page }) => {
    await page.goto('/admin/users');

    // Filter by "Instructor" role
    const roleFilter = page.locator('button[role="combobox"]').first();
    await roleFilter.click();
    await page.click('text=Instructor', { timeout: 5_000 });

    // Wait for the table to update
    await page.waitForTimeout(1_000);

    // Verify instructor@e2e.test is visible
    await expect(page.locator('text=instructor@e2e.test')).toBeVisible({ timeout: 10_000 });

    // Verify admin@e2e.test is NOT visible (filtered out)
    await expect(page.locator('text=admin@e2e.test')).not.toBeVisible({ timeout: 5_000 });
  });
});
