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
    // Monitor console for errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the new assignment wizard
    await page.goto('/instructor/assignments/new');
    await page.waitForLoadState('networkidle');

    // Step 1: Select template — wait for templates to load, then click
    await expect(page.locator('text=E2E Thesis Template')).toBeVisible({ timeout: 15_000 });
    await page.locator('text=E2E Thesis Template').click();

    // Click "Next" to proceed to details
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Fill assignment details
    await page.fill('#assignment-title', 'E2E Wizard Assignment');
    await page.fill('#assignment-desc', 'Assignment created via E2E test wizard.');

    // Set deadline to 90 days from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 90);
    const deadlineStr = deadline.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    await page.fill('#assignment-deadline', deadlineStr);

    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Select students — wait for student list to load
    await expect(page.locator('text=student@e2e.test')).toBeVisible({ timeout: 15_000 });
    await page.locator('text=student@e2e.test').click();

    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4: Due Dates — accept defaults and proceed
    await expect(page.getByRole('heading', { name: 'Due Dates' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 5: Confirm and create
    await expect(page.getByRole('heading', { name: 'Confirm & Create' })).toBeVisible({
      timeout: 10_000,
    });

    // Wait for the page to settle before clicking Create
    await page.waitForLoadState('networkidle');

    // Click "Create Assignment" and wait for navigation away from /new
    await page.getByRole('button', { name: 'Create Assignment' }).click();

    // Wait for navigation to assignment detail page (not /new)
    await expect(page).toHaveURL(/\/instructor\/assignments\/\d+/, { timeout: 30_000 });

    // Navigate to assignments list and verify the new assignment appears
    await page.goto('/instructor/assignments');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=E2E Wizard Assignment')).toBeVisible({ timeout: 15_000 });

    // Log any console errors for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors during test:', consoleErrors);
    }
  });

  test('seeded assignment has correct checkpoint states', async ({ page }) => {
    // Navigate to the assignments list
    await page.goto('/instructor/assignments');
    await page.waitForLoadState('networkidle');

    // Click on the seeded assignment's "View All" link
    await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
    await page.click('a:has-text("View All")');

    // Verify we're on the assignment detail page
    await expect(page).toHaveURL(/\/instructor\/assignments\/.+/, { timeout: 10_000 });

    // Verify checkpoint states — first checkpoint should be "Unlocked", rest "Locked"
    await expect(page.locator('text=Proposal').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Unlocked').first()).toBeVisible();
    await expect(page.locator('text=Locked').first()).toBeVisible();
  });
});
