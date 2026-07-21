import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

/**
 * Create a submission record directly in the DB and set checkpoint to 'submitted'.
 * Returns the submission ID for navigation.
 */
async function createSubmissionForCheckpoint(
  checkpointName: string,
): Promise<{ submissionId: string; checkpointId: string }> {
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
    VALUES (${checkpoint.id}, ${student.id}, 'e2e-test-file-key', 'test-thesis.pdf', 1024, 1)
    RETURNING id
  `;

  await sql`UPDATE checkpoints SET state = 'submitted' WHERE id = ${checkpoint.id}`;

  await sql.end();

  return { submissionId: submission.id, checkpointId: checkpoint.id };
}

test.describe('Instructor Review Flow', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'instructor');
  });

  test.use({ storageState: getAuthFilePath('instructor') });

  test('instructor sees pending submission in review queue', async ({ page }) => {
    // Set up a submission on the first checkpoint
    await createSubmissionForCheckpoint('Proposal');

    await page.goto('/instructor/reviews');
    await page.waitForLoadState('networkidle');

    // Verify the submission appears in the review queue
    // The table shows student name ("Student") and assignment title ("E2E Test Assignment")
    await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="review-queue-link"]').first()).toBeVisible();
  });

  test('instructor reviews with Pass → next checkpoint unlocks', async ({ page }) => {
    await page.goto('/instructor/reviews');
    await page.waitForLoadState('networkidle');

    // Click the review link to go to the review detail page
    await expect(page.locator('[data-testid="review-queue-link"]')).toBeVisible({
      timeout: 15_000,
    });
    await page.click('[data-testid="review-queue-link"]');

    // Verify we're on the review detail page
    await expect(page).toHaveURL(/\/instructor\/reviews\/.+/);
    await page.waitForLoadState('networkidle');

    // Wait for the review form to load
    await expect(page.locator('input[name="decision"][value="pass"]')).toBeVisible({
      timeout: 15_000,
    });

    // Select "Pass" decision
    await page.check('input[name="decision"][value="pass"]');

    // Add a comment
    await page.fill('#comment', 'Good work, approved!');

    // Submit the review
    await page.click('button:has-text("Submit Review")');

    // Verify success message
    await expect(page.locator('text=Review submitted successfully!')).toBeVisible({
      timeout: 15_000,
    });

    // Verify the next checkpoint (Chapter 1) is now unlocked via DB
    const sql = postgres(getDatabaseUrl());
    const [nextCheckpoint] = await sql`
      SELECT state FROM checkpoints WHERE name = 'Chapter 1'
    `;
    await sql.end();

    expect(nextCheckpoint.state).toBe('unlocked');
  });

  test('instructor reviews with Revise → revision deadline set', async ({ page }) => {
    // Set up a submission on Chapter 1 (now unlocked after Pass review)
    const { submissionId } = await createSubmissionForCheckpoint('Chapter 1');

    // Navigate directly to the review detail page
    await page.goto(`/instructor/reviews/${submissionId}`);
    await page.waitForLoadState('networkidle');

    // Wait for the review form to load
    await expect(page.locator('input[name="decision"][value="revise"]')).toBeVisible({
      timeout: 15_000,
    });

    // Select "Revise" decision
    await page.check('input[name="decision"][value="revise"]');

    // Wait for revision deadline input to appear (only shown when Revise is selected)
    await expect(page.locator('#revisionDeadline')).toBeVisible({ timeout: 5_000 });

    // Set revision deadline
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14);
    const deadlineStr = deadline.toISOString().slice(0, 10); // YYYY-MM-DD
    await page.fill('#revisionDeadline', deadlineStr);

    // Add a comment
    await page.fill('#comment', 'Please revise the introduction section.');

    // Submit the review
    await page.click('button:has-text("Submit Review")');

    // Verify success message
    await expect(page.locator('text=Review submitted successfully!')).toBeVisible({
      timeout: 15_000,
    });

    // Verify the checkpoint state is 'revise' in the DB
    const sql = postgres(getDatabaseUrl());
    const [checkpoint] = await sql`
      SELECT state FROM checkpoints WHERE name = 'Chapter 1'
    `;
    await sql.end();

    expect(checkpoint.state).toBe('revise');
  });

  test('review history shows past decisions', async ({ page }) => {
    // Find the Proposal submission's review detail page
    // The Proposal was reviewed with "Pass" in a previous test
    const sql = postgres(getDatabaseUrl());
    const [proposalSubmission] = await sql`
      SELECT s.id FROM submissions s
      JOIN checkpoints c ON s.checkpoint_id = c.id
      WHERE c.name = 'Proposal'
    `;
    await sql.end();

    await page.goto(`/instructor/reviews/${proposalSubmission.id}`);
    await page.waitForLoadState('networkidle');

    // Verify review history is visible and shows the "Passed" decision
    await expect(page.locator('text=Review History')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Passed').first()).toBeVisible({ timeout: 10_000 });
  });
});
