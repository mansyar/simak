import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
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
    await dialog.locator('input[name="email"]').fill('instructor3@e2e.test');

    // Select role "Instructor" from the dropdown
    await dialog.locator('button[role="combobox"]').click();
    await page.getByRole('option', { name: 'Instructor' }).click();

    // Submit the form via requestSubmit (Base UI Button defaults to type=button)
    await dialog.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());

    // Wait for the dialog to close and the user list to update
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Verify the new user appears in the user list table
    await expect(page.locator('table')).toContainText('instructor3@e2e.test', {
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

  test('admin edits a user name', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Find the student row and open the actions dropdown
    const row = page.locator('table tbody tr', { hasText: 'student@e2e.test' }).first();
    await row.getByRole('button', { name: 'Open menu' }).click();

    // Click "Edit" in the dropdown
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    // Wait for the edit sheet to appear
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    // Change the name
    const nameInput = sheet.locator('input[name="name"]');
    await nameInput.clear();
    await nameInput.fill('Edited Student Name');

    // Submit the form
    await sheet.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());

    // Wait for success toast
    await expect(page.getByText('User updated successfully')).toBeVisible({ timeout: 10_000 });

    // Verify the updated name appears in the table
    await expect(page.locator('table')).toContainText('Edited Student Name', { timeout: 10_000 });
  });

  test('admin deletes instructor with assignment reassignment', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Find the instructor row and open the actions dropdown
    const row = page.locator('table tbody tr', { hasText: 'instructor@e2e.test' }).first();
    await row.getByRole('button', { name: 'Open menu' }).click();

    // Click "Delete" in the dropdown
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Wait for the delete confirmation dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible({ timeout: 10_000 });

    // Click "Delete" to confirm — server returns BAD_REQUEST, triggering reassignment flow
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();

    // Wait for ReassignmentDialog to appear (contains assignment title)
    await expect(page.getByRole('dialog').getByText('E2E Test Assignment')).toBeVisible({
      timeout: 15_000,
    });
    const reassignDialog = page.getByRole('dialog');

    // Select replacement instructor from the dropdown
    await reassignDialog.locator('[data-slot="select-trigger"]').click();
    await page.locator('[data-slot="select-item"]').filter({ hasText: 'Instructor Two' }).click();

    // Wait for "Done" badge to appear (reassignment complete)
    await expect(reassignDialog.getByText('Done', { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // Verify reassignment actually changed instructorId in DB
    const sql = postgres(getDatabaseUrl());
    const [assignment] = await sql`
      SELECT instructor_id FROM assignments
      WHERE title = 'E2E Test Assignment' AND deleted_at IS NULL
      LIMIT 1
    `;
    const [newInstructorRow] = await sql`
      SELECT id FROM users
      WHERE email = 'instructor2@e2e.test' AND deleted_at IS NULL
      LIMIT 1
    `;
    await sql.end();

    // If reassignment didn't work, the test should fail here with a clear message
    expect(assignment?.instructor_id).toBe(newInstructorRow?.id);

    // Click "Delete" to finalize the deletion
    await reassignDialog.getByRole('button', { name: 'Delete' }).click();

    // Wait for ReassignmentDialog to close (only happens on successful deletion)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });

    // Check DB directly: is the instructor soft-deleted?
    const sql2 = postgres(getDatabaseUrl());
    const [deletedUser] = await sql2`
      SELECT id, deleted_at FROM users WHERE email = 'instructor@e2e.test' LIMIT 1
    `;
    await sql2.end();
    expect(deletedUser?.deleted_at).not.toBeNull();

    // Reload the page to force a fresh server-side fetch
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify the instructor is no longer in the table
    await expect(page.locator('table')).not.toContainText('instructor@e2e.test', {
      timeout: 15_000,
    });
  });

  test('admin deletes user without assignments directly', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Find student3 (no active assignments) and open the actions dropdown
    const row = page.locator('table tbody tr', { hasText: 'student3@e2e.test' }).first();
    await row.getByRole('button', { name: 'Open menu' }).click();

    // Click "Delete" in the dropdown
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Wait for the delete confirmation dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible({ timeout: 10_000 });

    // Click "Delete" to confirm — direct deletion (no reassignment needed)
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();

    // Verify the user is removed from the table (no ReassignmentDialog appears)
    await expect(page.locator('table')).not.toContainText('student3@e2e.test', {
      timeout: 10_000,
    });
  });
});
