import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';
import {
  getTemplateCheckpointId,
  setupNumericRubric,
  linkCheckpointsToTemplate,
} from './helpers/rubric-setup';

const STUDENT_EMAIL = 'student@e2e.test';

/**
 * Create a submission record directly in the DB and set checkpoint to 'submitted'.
 * Adapted from instructor-review.spec.ts.
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

  await sql`DELETE FROM review_scores WHERE review_id IN (SELECT id FROM reviews WHERE submission_id IN (SELECT id FROM submissions WHERE checkpoint_id = ${checkpoint.id}))`;
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

test.describe('Rubric Grading Flow', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'instructor');
  });

  test.use({ storageState: getAuthFilePath('instructor') });

  test('instructor reviews with numeric rubric scoring', async ({ page }) => {
    // --- Setup: configure numeric rubric on the Proposal template checkpoint ---
    const templateCheckpointId = await getTemplateCheckpointId('Proposal');
    const criteria = await setupNumericRubric(templateCheckpointId, [
      { title: 'Content Quality', weight: 60 },
      { title: 'Technical Accuracy', weight: 40 },
    ]);

    // --- Link the student's checkpoint to its template checkpoint ---
    // (seed script doesn't set template_checkpoint_id, which is required for rubric loading)
    await linkCheckpointsToTemplate('Proposal', templateCheckpointId);

    // --- Setup: create a submission for the student's Proposal checkpoint ---
    const { submissionId } = await createSubmissionForCheckpoint('Proposal');

    // --- Navigate to the review page ---
    await page.goto(`/instructor/reviews/${submissionId}`);
    await page.waitForLoadState('networkidle');

    // --- Verify rubric scoring section is visible ---
    await expect(page.getByText('Content Quality')).toBeVisible();
    await expect(page.getByText('Technical Accuracy')).toBeVisible();
    await expect(page.getByText('Weighted Total')).toBeVisible();

    // --- Fill in numeric scores ---
    // Criterion 1: Content Quality (weight 60, score 85 → 85 * 60 / 100 = 51)
    await page.locator(`#score-${criteria[0].id}`).fill('85');
    // Criterion 2: Technical Accuracy (weight 40, score 90 → 90 * 40 / 100 = 36)
    await page.locator(`#score-${criteria[1].id}`).fill('90');

    // --- Verify weighted total auto-computes (51 + 36 = 87) ---
    await expect(page.getByText('87 / 100')).toBeVisible({ timeout: 5000 });

    // --- Select Pass and submit review ---
    await page.check('input[name="decision"][value="pass"]');
    await page.fill('#comment', 'Good work, rubric scores applied.');
    await page.click('button:has-text("Submit Review")');

    // --- Verify success message ---
    await expect(page.getByText('Review submitted successfully!')).toBeVisible({
      timeout: 15000,
    });

    // --- Verify review_scores persisted in DB ---
    const sql = postgres(getDatabaseUrl());
    const scores = await sql`
      SELECT rs.criterion_title, rs.score, rs.weight
      FROM review_scores rs
      JOIN reviews r ON rs.review_id = r.id
      WHERE r.submission_id = ${submissionId}
      ORDER BY rs.criterion_title
    `;
    await sql.end();

    expect(scores).toHaveLength(2);
    expect(scores[0].criterion_title).toBe('Content Quality');
    expect(scores[0].score).toBe(85);
    expect(scores[0].weight).toBe(60);
    expect(scores[1].criterion_title).toBe('Technical Accuracy');
    expect(scores[1].score).toBe(90);
    expect(scores[1].weight).toBe(40);
  });
});
