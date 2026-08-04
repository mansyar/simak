import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

test.describe('Checkpoint Discussions', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await resetDatabase();
  });

  async function getCheckpointAndAssignmentIds() {
    const sql = postgres(getDatabaseUrl());
    const [row] = await sql`
      SELECT c.id AS checkpoint_id, c.assignment_id
      FROM checkpoints c
      JOIN users u ON c.student_id = u.id
      WHERE u.email = 'student@e2e.test' AND c.name = 'Proposal'
      LIMIT 1
    `;
    await sql.end();
    return { checkpointId: row.checkpoint_id, assignmentId: row.assignment_id };
  }

  async function createSubmissionForCheckpoint(): Promise<number> {
    const sql = postgres(getDatabaseUrl());
    const { checkpointId } = await getCheckpointAndAssignmentIds();

    // Get student user ID
    const [student] = await sql`
      SELECT id FROM users WHERE email = 'student@e2e.test' LIMIT 1
    `;

    // Clean up existing reviews/submissions
    await sql`DELETE FROM review_scores WHERE review_id IN (SELECT id FROM reviews WHERE submission_id IN (SELECT id FROM submissions WHERE checkpoint_id = ${checkpointId}))`;
    await sql`DELETE FROM reviews WHERE submission_id IN (SELECT id FROM submissions WHERE checkpoint_id = ${checkpointId})`;
    await sql`DELETE FROM submissions WHERE checkpoint_id = ${checkpointId}`;

    // Insert a submission
    const [submission] = await sql`
      INSERT INTO submissions (checkpoint_id, version, file_key, file_name, file_size, uploaded_at, uploaded_by)
      VALUES (${checkpointId}, 1, 'e2e-test.pdf', 'e2e-test.pdf', 1024, NOW(), ${student.id})
      RETURNING id
    `;

    // Set checkpoint state to submitted
    await sql`UPDATE checkpoints SET state = 'submitted' WHERE id = ${checkpointId}`;

    await sql.end();
    return submission.id;
  }

  // --- Student posts a message ---

  test.describe('Student posts message', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'student');
    });

    test.use({ storageState: getAuthFilePath('student') });

    test('student posts a message on checkpoint page', async ({ page }) => {
      const { checkpointId, assignmentId } = await getCheckpointAndAssignmentIds();

      await page.goto(`/student/assignments/${assignmentId}/checkpoints/${checkpointId}`);
      await page.waitForLoadState('networkidle');

      // Verify empty state initially
      await expect(page.getByText('No messages yet')).toBeVisible();

      // Post a message
      await page.getByPlaceholder('Write a message...').fill('E2E test discussion message');
      await page.getByRole('button', { name: 'Send' }).click();

      // Verify message appears (scoped to data-role to avoid matching textarea content)
      await expect(
        page.locator('[data-role="student"]').filter({ hasText: 'E2E test discussion message' }),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // --- Instructor replies ---

  test.describe('Instructor replies', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'instructor');
    });

    test.use({ storageState: getAuthFilePath('instructor') });

    test('instructor sees student message and replies', async ({ page }) => {
      // Create a submission so the instructor can access the review detail page
      const submissionId = await createSubmissionForCheckpoint();

      // Navigate to the review detail page (single DiscussionPanel)
      await page.goto(`/instructor/reviews/${submissionId}`);
      await page.waitForLoadState('networkidle');

      // Wait for student's message to appear
      await expect(
        page.locator('[data-role="student"]').filter({ hasText: 'E2E test discussion message' }),
      ).toBeVisible({ timeout: 15000 });

      // Find the student's message container and click Reply
      const messageContainer = page
        .locator('[data-role="student"]')
        .filter({ hasText: 'E2E test discussion message' });
      await messageContainer.getByRole('button', { name: 'Reply' }).click();

      // Wait for the Cancel button to appear (at panel level, not inside message container)
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible({ timeout: 5000 });

      // Type reply in the main form textarea (same form, replyTo is set)
      await page.getByPlaceholder('Write a message...').fill('E2E test instructor reply');
      await page.getByRole('button', { name: 'Send' }).click();

      // Verify reply appears with data-reply attribute (indentation)
      await expect(
        page.locator('[data-reply]').filter({ hasText: 'E2E test instructor reply' }),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // --- Student sees reply and deletes own message ---

  test.describe('Student verifies reply and deletes', () => {
    test.use({ storageState: getAuthFilePath('student') });

    test('student sees instructor reply and deletes own message', async ({ page }) => {
      const { checkpointId, assignmentId } = await getCheckpointAndAssignmentIds();

      await page.goto(`/student/assignments/${assignmentId}/checkpoints/${checkpointId}`);
      await page.waitForLoadState('networkidle');

      // Verify student's original message is visible (scoped to avoid ambiguity)
      await expect(
        page.locator('[data-role="student"]').filter({ hasText: 'E2E test discussion message' }),
      ).toBeVisible();

      // Verify instructor reply is visible with data-reply (indentation)
      await expect(
        page.locator('[data-reply]').filter({ hasText: 'E2E test instructor reply' }),
      ).toBeVisible();

      // Delete own message (within 15-min window)
      const messageContainer = page
        .locator('[data-role="student"]')
        .filter({ hasText: 'E2E test discussion message' });
      await messageContainer.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

      // Verify message shows [deleted]
      await expect(page.getByText('[deleted]')).toBeVisible({ timeout: 10000 });

      // Verify instructor reply is still visible (replies are preserved)
      await expect(
        page.locator('[data-reply]').filter({ hasText: 'E2E test instructor reply' }),
      ).toBeVisible();
    });
  });
});
