import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

const STUDENT_EMAIL = 'student@e2e.test';

/**
 * Resolve a checkpoint by name for a specific student.
 * Filters by student email to avoid ambiguity when multiple students share
 * checkpoint names (e.g., both student1 and student2 have a "Proposal" checkpoint).
 */
async function getCheckpointId(
  checkpointName: string,
  studentEmail = STUDENT_EMAIL,
): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`
    SELECT c.id FROM checkpoints c
    JOIN users u ON c.student_id = u.id
    WHERE c.name = ${checkpointName} AND u.email = ${studentEmail}
  `;
  await sql.end();
  if (!row) throw new Error(`Checkpoint "${checkpointName}" for ${studentEmail} not found`);
  return row.id;
}

/**
 * Create a submission record directly in the DB and set checkpoint to 'submitted'.
 * Cleans up any existing submissions/reviews for the checkpoint first to ensure
 * test isolation (unique constraint on checkpointId + version).
 *
 * Returns the submission ID for navigation.
 */
async function createSubmissionForCheckpoint(
  checkpointName: string,
  studentEmail = STUDENT_EMAIL,
): Promise<{ submissionId: number; checkpointId: number }> {
  const sql = postgres(getDatabaseUrl());

  const [checkpoint] = await sql`
    SELECT c.id FROM checkpoints c
    JOIN users u ON c.student_id = u.id
    WHERE c.name = ${checkpointName} AND u.email = ${studentEmail}
  `;

  if (!checkpoint) {
    await sql.end();
    throw new Error(`Checkpoint "${checkpointName}" for ${studentEmail} not found`);
  }

  // Clean up any existing submissions and reviews for this checkpoint
  await sql`DELETE FROM reviews WHERE submission_id IN (SELECT id FROM submissions WHERE checkpoint_id = ${checkpoint.id})`;
  await sql`DELETE FROM submissions WHERE checkpoint_id = ${checkpoint.id}`;

  const [submission] = await sql`
    INSERT INTO submissions (checkpoint_id, uploaded_by, file_key, file_name, file_size, version)
    VALUES (
      ${checkpoint.id},
      (SELECT id FROM users WHERE email = ${studentEmail}),
      'e2e-test-file-key',
      'test-thesis.pdf',
      1024,
      1
    )
    RETURNING id
  `;

  await sql`UPDATE checkpoints SET state = 'submitted' WHERE id = ${checkpoint.id}`;

  await sql.end();

  return { submissionId: submission.id, checkpointId: checkpoint.id };
}

/**
 * Set a checkpoint's state directly in the DB.
 */
async function setCheckpointState(
  checkpointName: string,
  state: string,
  studentEmail = STUDENT_EMAIL,
): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  await sql`
    UPDATE checkpoints SET state = ${state}
    WHERE id = (
      SELECT c.id FROM checkpoints c
      JOIN users u ON c.student_id = u.id
      WHERE c.name = ${checkpointName} AND u.email = ${studentEmail}
    )
  `;
  await sql.end();
}

/**
 * Insert a review record directly in the DB for a given submission.
 * Used to set up review history state without going through the UI.
 */
async function insertReview(
  submissionId: number,
  decision: 'pass' | 'revise',
  comment: string,
): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  const [instructor] = await sql`SELECT id FROM users WHERE email = 'instructor@e2e.test'`;
  await sql`
    INSERT INTO reviews (submission_id, instructor_id, decision, comment, reviewed_at)
    VALUES (${submissionId}, ${instructor.id}, ${decision}, ${comment}, NOW())
  `;
  await sql.end();
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
    // Set up own submission state (decoupled from other tests)
    await createSubmissionForCheckpoint('Proposal');

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
    const nextCheckpointId = await getCheckpointId('Chapter 1');
    const sql = postgres(getDatabaseUrl());
    const [nextCheckpoint] =
      await sql`SELECT state FROM checkpoints WHERE id = ${nextCheckpointId}`;
    await sql.end();

    expect(nextCheckpoint.state).toBe('unlocked');
  });

  test('instructor reviews with Revise → revision deadline set', async ({ page }) => {
    // Set up own state: unlock Chapter 1 and create a submission
    await setCheckpointState('Chapter 1', 'unlocked');
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
    const checkpointId = await getCheckpointId('Chapter 1');
    const sql = postgres(getDatabaseUrl());
    const [checkpoint] = await sql`SELECT state FROM checkpoints WHERE id = ${checkpointId}`;
    await sql.end();

    expect(checkpoint.state).toBe('revise');
  });

  test('review history shows past decisions', async ({ page }) => {
    // Set up own state: create submission and insert a Pass review via DB
    const { submissionId } = await createSubmissionForCheckpoint('Proposal');
    await insertReview(submissionId, 'pass', 'Good work, approved!');

    await page.goto(`/instructor/reviews/${submissionId}`);
    await page.waitForLoadState('networkidle');

    // Verify review history is visible and shows the "Passed" decision
    await expect(page.locator('text=Review History')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Passed').first()).toBeVisible({ timeout: 10_000 });
  });
});
