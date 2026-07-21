import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

/**
 * Create a submission record directly in the DB and set checkpoint state.
 * Returns the submission ID.
 *
 * Note: We use direct DB insertion because the R2 mock via page.route()
 * does not work with TanStack Start's server function response format.
 * The client returns `undefined` for mocked responses, preventing the
 * upload flow from completing. See r2-mock.ts for the mock implementation.
 */
async function createSubmissionForCheckpoint(
  checkpointName: string,
  fileName: string,
  version: number,
): Promise<string> {
  const sql = postgres(getDatabaseUrl());

  const [checkpoint] = await sql`
    SELECT id FROM checkpoints WHERE name = ${checkpointName}
  `;

  if (!checkpoint) {
    await sql.end();
    throw new Error(`Checkpoint "${checkpointName}" not found`);
  }

  const [student] = await sql`
    SELECT id FROM users WHERE email = 'student@e2e.test'
  `;

  if (!student) {
    await sql.end();
    throw new Error('Student user not found');
  }

  const [submission] = await sql`
    INSERT INTO submissions (checkpoint_id, uploaded_by, file_key, file_name, file_size, version)
    VALUES (${checkpoint.id}, ${student.id}, 'e2e-test-file-key', ${fileName}, 1024, ${version})
    RETURNING id
  `;

  await sql`UPDATE checkpoints SET state = 'submitted' WHERE id = ${checkpoint.id}`;
  await sql.end();

  return submission.id;
}

/**
 * Set a checkpoint's state directly in the DB.
 */
async function setCheckpointState(checkpointName: string, state: string): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  await sql`UPDATE checkpoints SET state = ${state} WHERE name = ${checkpointName}`;
  await sql.end();
}

test.describe('Student File Submission', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'student');
  });

  test.use({ storageState: getAuthFilePath('student') });

  test('student sees upload form and submission appears in version history', async ({ page }) => {
    // Navigate to assignments list
    await page.goto('/student/assignments');
    await page.waitForLoadState('networkidle');

    // Click on the seeded assignment's "View All" link
    await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
    await page.click('a:has-text("View All")');

    // Verify we're on the assignment detail page
    await expect(page).toHaveURL(/\/student\/assignments\/\d+/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Verify "Proposal" checkpoint with "Submit" button is visible
    await expect(page.locator('text=Proposal')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Submit")')).toBeVisible();

    // Click "Submit" on the first checkpoint (Proposal — unlocked)
    await page.click('button:has-text("Submit")');

    // Verify we're on the checkpoint submission page
    await expect(page).toHaveURL(/\/checkpoints\/.+/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Verify the file uploader UI is visible
    await expect(page.locator('[data-testid="drop-zone"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="file-input"]')).toBeAttached();

    // Create a submission directly in the DB (bypassing R2 upload)
    await createSubmissionForCheckpoint('Proposal', 'test-thesis.pdf', 1);

    // Reload the page to see the submission in the file list
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify the submission appears in the file list
    await expect(page.locator('text=test-thesis.pdf')).toBeVisible({ timeout: 10_000 });
  });

  test('student sees resubmit form after revise and new version appears', async ({ page }) => {
    // Set the checkpoint state to 'revise' for the resubmit test
    await setCheckpointState('Proposal', 'revise');

    // Navigate to the assignment detail
    await page.goto('/student/assignments');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
    await page.click('a:has-text("View All")');

    // Verify we're on the assignment detail page
    await expect(page).toHaveURL(/\/student\/assignments\/\d+/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Verify "Proposal" checkpoint with "Resubmit" button is visible
    await expect(page.locator('text=Proposal')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Resubmit")')).toBeVisible();

    // Click "Resubmit" on the first checkpoint
    await page.click('button:has-text("Resubmit")');

    // Verify we're on the checkpoint submission page
    await expect(page).toHaveURL(/\/checkpoints\/.+/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Verify the file uploader UI is visible
    await expect(page.locator('[data-testid="drop-zone"]')).toBeVisible({ timeout: 10_000 });

    // Create a second submission directly in the DB
    await createSubmissionForCheckpoint('Proposal', 'test-thesis-v2.pdf', 2);

    // Reload the page to see the new submission in the file list
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify the new submission appears in the file list
    await expect(page.locator('text=test-thesis-v2.pdf')).toBeVisible({ timeout: 10_000 });

    // Verify the "Latest" badge is shown for the most recent submission
    await expect(page.locator('text=Latest').first()).toBeVisible({ timeout: 10_000 });
  });
});
