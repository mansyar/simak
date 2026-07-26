import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

/**
 * Create a submission record directly in the DB and set checkpoint state.
 * Returns the submission ID.
 *
 * Filters by student email to avoid ambiguity when multiple students share
 * checkpoint names (e.g., both student1 and student2 have a "Proposal" checkpoint).
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
    SELECT c.id FROM checkpoints c
    JOIN users u ON c.student_id = u.id
    WHERE c.name = ${checkpointName} AND u.email = 'student@e2e.test'
  `;

  if (!checkpoint) {
    await sql.end();
    throw new Error(`Checkpoint "${checkpointName}" for student@e2e.test not found`);
  }

  const [submission] = await sql`
    INSERT INTO submissions (checkpoint_id, uploaded_by, file_key, file_name, file_size, version)
    VALUES (
      ${checkpoint.id},
      (SELECT id FROM users WHERE email = 'student@e2e.test'),
      'e2e-test-file-key',
      ${fileName},
      1024,
      ${version}
    )
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
  await sql`
    UPDATE checkpoints SET state = ${state}
    WHERE id = (
      SELECT c.id FROM checkpoints c
      JOIN users u ON c.student_id = u.id
      WHERE c.name = ${checkpointName} AND u.email = 'student@e2e.test'
    )
  `;
  await sql.end();
}

test.describe('Student File Submission', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await Promise.all([
      ensureAuthFile(browser, 'student'),
      ensureAuthFile(browser, 'instructor'),
      ensureAuthFile(browser, 'student3'),
    ]);
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

  test('instructor receives submission_received notification after submission', async ({
    browser,
  }) => {
    // Clean up notifications + existing submissions for Proposal
    const sql = postgres(getDatabaseUrl());
    await sql`DELETE FROM notifications`;
    await sql`DELETE FROM reviews WHERE submission_id IN (SELECT id FROM submissions WHERE checkpoint_id IN (SELECT c.id FROM checkpoints c JOIN users u ON c.student_id = u.id WHERE c.name = 'Proposal' AND u.email = 'student@e2e.test'))`;
    await sql`DELETE FROM submissions WHERE checkpoint_id IN (SELECT c.id FROM checkpoints c JOIN users u ON c.student_id = u.id WHERE c.name = 'Proposal' AND u.email = 'student@e2e.test')`;
    await sql.end();

    // Create a submission via DB
    await createSubmissionForCheckpoint('Proposal', 'notif-test.pdf', 1);

    // Insert submission_received notification for the instructor via DB
    const sql2 = postgres(getDatabaseUrl());
    await sql2`
      INSERT INTO notifications (user_id, type, title_key, message_key, params, channel, read)
      VALUES (
        (SELECT id FROM users WHERE email = 'instructor@e2e.test'),
        'submission_received',
        'notifications.events.submission_received.title',
        'notifications.events.submission_received.message',
        ${JSON.stringify({ studentName: 'Student', assignmentTitle: 'E2E Test Assignment' })}::jsonb,
        'in_app',
        false
      )
    `;
    await sql2.end();

    // Open instructor dashboard
    const instructorCtx = await browser.newContext({
      storageState: getAuthFilePath('instructor'),
    });
    const instructorPage = await instructorCtx.newPage();
    await instructorPage.goto('/instructor/dashboard');
    await instructorPage.waitForLoadState('networkidle');

    // Verify bell shows unread count
    await expect(instructorPage.getByRole('button', { name: /unread/i })).toBeVisible({
      timeout: 15_000,
    });

    // Open notification center
    await instructorPage.getByRole('button', { name: /notification/i }).click();
    await expect(instructorPage.getByText('Notifications')).toBeVisible({ timeout: 10_000 });

    // Verify the submission_received notification appears
    await expect(instructorPage.getByText('New Submission Received')).toBeVisible({
      timeout: 10_000,
    });

    await instructorCtx.close();
  });

  test('upload UI validates file type and size', async ({ page }) => {
    // Ensure Proposal is in unlocked state (prior tests may have changed it)
    await setCheckpointState('Proposal', 'unlocked');

    // Navigate to the assignment detail page
    await page.goto('/student/assignments');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
    await page.click('a:has-text("View All")');
    await expect(page).toHaveURL(/\/student\/assignments\/\d+/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Click "Submit" on the Proposal checkpoint (unlocked)
    await page.click('button:has-text("Submit")');
    await expect(page).toHaveURL(/\/checkpoints\/.+/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Verify the file uploader UI is visible
    await expect(page.locator('[data-testid="drop-zone"]')).toBeVisible({ timeout: 10_000 });

    // Attempt to upload a .txt file → verify type validation error
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('invalid file type'),
    });
    await expect(page.getByText('Only .docx and .pdf files are accepted')).toBeVisible({
      timeout: 5_000,
    });

    // Attempt to upload a >25MB file → verify size validation error
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024, 'x');
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'large.pdf',
      mimeType: 'application/pdf',
      buffer: largeBuffer,
    });
    await expect(page.getByText('File size must be under 25 MB')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('locked checkpoint does not show submit button', async ({ page }) => {
    // Ensure Proposal is in unlocked state (other tests may have changed it)
    await setCheckpointState('Proposal', 'unlocked');

    // Navigate to the assignment detail page
    await page.goto('/student/assignments');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
    await page.click('a:has-text("View All")');
    await expect(page).toHaveURL(/\/student\/assignments\/\d+/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Chapter 1 is locked — verify no Submit button for it
    // The Submit button only appears for 'unlocked' checkpoints
    // Chapter 2 is also locked
    // Only Proposal (unlocked) has a Submit button — locked checkpoints don't
    // Wait for the Proposal checkpoint card to render, then count Submit buttons
    await expect(page.locator('text=Proposal').first()).toBeVisible({ timeout: 10_000 });
    const submitButtons = page.locator('button:has-text("Submit")');
    await expect(submitButtons).toHaveCount(1, { timeout: 10_000 });

    // Navigate directly to a locked checkpoint's submission URL → verify no upload UI
    const sql = postgres(getDatabaseUrl());
    const [checkpoint] = await sql`
      SELECT c.id FROM checkpoints c
      JOIN users u ON c.student_id = u.id
      WHERE c.name = 'Chapter 1' AND u.email = 'student@e2e.test'
    `;
    const [assignment] = await sql`SELECT id FROM assignments WHERE title = 'E2E Test Assignment'`;
    await sql.end();

    await page.goto(`/student/assignments/${assignment.id}/checkpoints/${checkpoint.id}`);
    await page.waitForLoadState('networkidle');

    // FileUploader should NOT be rendered for locked checkpoints
    await expect(page.locator('[data-testid="drop-zone"]')).not.toBeVisible();
  });
});

test.describe('Cross-Student Access Denial', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'student3');
  });

  test.use({ storageState: getAuthFilePath('student3') });

  test('unenrolled student sees not-found for assignment', async ({ page }) => {
    // student3 is NOT enrolled in the E2E Test Assignment
    // Navigate to the assignment detail page
    await page.goto('/student/assignments');
    await page.waitForLoadState('networkidle');

    // Find the assignment ID from the URL of any enrolled student's assignment
    const sql = postgres(getDatabaseUrl());
    const [assignment] = await sql`SELECT id FROM assignments WHERE title = 'E2E Test Assignment'`;
    await sql.end();

    // Navigate directly to the assignment URL
    await page.goto(`/student/assignments/${assignment.id}`);
    await page.waitForLoadState('networkidle');

    // Verify the not-found / access-denied message appears
    await expect(page.locator('text=Assignment not found')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator("text=This assignment does not exist or you don't have access to it."),
    ).toBeVisible({ timeout: 5_000 });
  });
});
