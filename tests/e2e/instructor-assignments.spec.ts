import { test, expect } from '@playwright/test';
import { resetDatabase } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

test.describe('Instructor Assignment Management', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'instructor');
  });

  test.use({ storageState: getAuthFilePath('instructor') });

  test('instructor creates assignment from template', async ({ page }) => {
    // Navigate to assignments list
    await page.goto('/instructor/assignments');

    // Go to the new assignment wizard
    await page.goto('/instructor/assignments/new');

    // Step 1: Select template — wait for templates to load, then click
    await expect(page.locator('text=E2E Thesis Template')).toBeVisible({ timeout: 15_000 });
    await page.click('text=E2E Thesis Template');

    // Click "Next" to proceed to details
    await page.click('button:has-text("Next")');

    // Step 2: Fill assignment details
    await page.fill('#assignment-title', 'E2E Wizard Assignment');
    await page.fill('#assignment-desc', 'Assignment created via E2E test wizard.');

    // Set deadline to 90 days from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 90);
    const deadlineStr = deadline.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    await page.fill('#assignment-deadline', deadlineStr);

    await page.click('button:has-text("Next")');

    // Step 3: Select students — wait for student list to load
    await expect(page.locator('text=student@e2e.test')).toBeVisible({ timeout: 15_000 });
    await page.click('text=student@e2e.test');

    await page.click('button:has-text("Next")');

    // Step 4: Confirm and create
    await page.click('button:has-text("Create")');

    // Verify we're redirected to the assignments list or detail page
    await expect(page).toHaveURL(/\/instructor\/assignments/, { timeout: 15_000 });

    // Navigate to assignments list and verify the new assignment appears
    await page.goto('/instructor/assignments');
    await expect(page.locator('text=E2E Wizard Assignment')).toBeVisible({ timeout: 15_000 });
  });

  test('seeded assignment has correct checkpoint states', async ({ page }) => {
    // Navigate to the seeded assignment's detail page
    await page.goto('/instructor/assignments');

    // Click on the seeded assignment
    await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
    await page.click('text=E2E Test Assignment');

    // Verify we're on the assignment detail page
    await expect(page).toHaveURL(/\/instructor\/assignments\/.+/);

    // Verify checkpoint states — first checkpoint should be "Unlocked", rest "Locked"
    await expect(page.locator('text=Proposal')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Unlocked').first()).toBeVisible();
    await expect(page.locator('text=Locked').first()).toBeVisible();
  });
});
