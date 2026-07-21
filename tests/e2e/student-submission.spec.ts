import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';
import { setupR2Mocks } from './helpers/r2-mock';

/**
 * Set a checkpoint's state directly in the DB.
 * Used to set up the 'revise' state for the resubmit test.
 */
async function setCheckpointState(checkpointName: string, state: string): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL!);
  await sql`UPDATE checkpoints SET state = ${state} WHERE name = ${checkpointName}`;
  await sql.end();
}

test.describe('Student File Submission', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'student');
  });

  test.use({ storageState: getAuthFilePath('student') });

  test('student uploads a file for the first checkpoint', async ({ page }) => {
    // Set up R2 mocks before navigating
    await setupR2Mocks(page);

    // Navigate to assignments list
    await page.goto('/student/assignments');

    // Click on the seeded assignment
    await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
    await page.click('text=E2E Test Assignment');

    // Verify we're on the assignment detail page
    await expect(page).toHaveURL(/\/student\/assignments\/.+/);

    // Click "Submit" on the first checkpoint (Proposal — unlocked)
    await expect(page.locator('text=Proposal')).toBeVisible({ timeout: 10_000 });
    await page.click('button:has-text("Submit")');

    // Verify we're on the checkpoint submission page
    await expect(page).toHaveURL(/\/checkpoints\/.+/);

    // Upload a file — set file on the hidden input
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'test-thesis.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test file content'),
    });

    // Click the "Upload" button
    await page.click('button:has-text("Upload")');

    // Verify upload success message
    await expect(page.locator('text=File uploaded successfully!')).toBeVisible({
      timeout: 15_000,
    });

    // Verify submission appears in the file list with version 1
    await expect(page.locator('text=test-thesis.pdf')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Version 1').first()).toBeVisible({ timeout: 10_000 });
  });

  test('student resubmits after revise', async ({ page }) => {
    // Set the checkpoint state to 'revise' for the resubmit test
    await setCheckpointState('Proposal', 'revise');

    // Set up R2 mocks
    await setupR2Mocks(page);

    // Navigate to the assignment detail
    await page.goto('/student/assignments');

    await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
    await page.click('text=E2E Test Assignment');

    // Click "Resubmit" on the first checkpoint (now in 'revise' state)
    await expect(page.locator('text=Proposal')).toBeVisible({ timeout: 10_000 });
    await page.click('button:has-text("Resubmit")');

    // Verify we're on the checkpoint submission page
    await expect(page).toHaveURL(/\/checkpoints\/.+/);

    // Upload a new file
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'test-thesis-v2.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test file content v2'),
    });

    await page.click('button:has-text("Upload")');

    // Verify upload success
    await expect(page.locator('text=File uploaded successfully!')).toBeVisible({
      timeout: 15_000,
    });

    // Verify version 2 appears in the submission history
    await expect(page.locator('text=test-thesis-v2.pdf')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Version 2').first()).toBeVisible({ timeout: 10_000 });
  });
});
