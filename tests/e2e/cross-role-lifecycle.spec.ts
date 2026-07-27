import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { loginAsRole } from './helpers/auth';

const STUDENT_EMAIL = 'student@e2e.test';

// ---------------------------------------------------------------------------
// DB Helpers
// ---------------------------------------------------------------------------

async function getCheckpointId(name: string, email = STUDENT_EMAIL): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`
    SELECT c.id FROM checkpoints c
    JOIN users u ON c.student_id = u.id
    WHERE c.name = ${name} AND u.email = ${email}
  `;
  await sql.end();
  if (!row) throw new Error(`Checkpoint "${name}" for ${email} not found`);
  return row.id;
}

async function getCheckpointState(name: string, email = STUDENT_EMAIL): Promise<string> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`
    SELECT state FROM checkpoints c
    JOIN users u ON c.student_id = u.id
    WHERE c.name = ${name} AND u.email = ${email}
  `;
  await sql.end();
  if (!row) throw new Error(`Checkpoint "${name}" for ${email} not found`);
  return row.state;
}

async function cleanupConsultations(): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  await sql`DELETE FROM consultations`;
  await sql.end();
}

async function createSubmissionForCheckpoint(
  checkpointName: string,
  email = STUDENT_EMAIL,
): Promise<{ submissionId: number; checkpointId: number }> {
  const sql = postgres(getDatabaseUrl());
  const checkpointId = await getCheckpointId(checkpointName, email);

  // Clean up prior reviews and submissions for this checkpoint
  await sql`DELETE FROM review_scores WHERE review_id IN (SELECT id FROM reviews WHERE submission_id IN (SELECT id FROM submissions WHERE checkpoint_id = ${checkpointId}))`;
  await sql`DELETE FROM reviews WHERE submission_id IN (SELECT id FROM submissions WHERE checkpoint_id = ${checkpointId})`;
  await sql`DELETE FROM submissions WHERE checkpoint_id = ${checkpointId}`;

  // Insert a new submission
  const [submission] = await sql`
    INSERT INTO submissions (checkpoint_id, uploaded_by, file_key, file_name, file_size)
    VALUES (
      ${checkpointId},
      (SELECT id FROM users WHERE email = ${email}),
      ${'e2e-cross-role/' + checkpointName + '-' + Date.now() + '.pdf'},
      'test-file.pdf',
      1024
    )
    RETURNING id
  `;

  // Set checkpoint state to 'submitted' so it appears in the review queue
  await sql`UPDATE checkpoints SET state = 'submitted' WHERE id = ${checkpointId}`;

  await sql.end();
  return { submissionId: submission.id, checkpointId };
}

// ---------------------------------------------------------------------------
// Navigation Helpers
// ---------------------------------------------------------------------------

async function navigateToStudentAssignment(page: Page): Promise<void> {
  await page.goto('/student/assignments');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
  await page.click('a:has-text("View All")');
  await expect(page).toHaveURL(/\/student\/assignments\/\d+/, { timeout: 10_000 });
  await page.waitForLoadState('networkidle');
}

async function navigateToInstructorAssignment(page: Page): Promise<void> {
  await page.goto('/instructor/assignments');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
  await page.click('a:has-text("View All")');
  await expect(page).toHaveURL(/\/instructor\/assignments\/\d+/, { timeout: 10_000 });
  await page.waitForLoadState('networkidle');
}

async function clickConsultationsTab(page: Page): Promise<void> {
  await page.click('button:has-text("Consultations")');
  await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe('Cross-Role Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await resetDatabase();
  });

  test('full lifecycle: consultation → review Pass → Revise → resubmit → Pass → completion', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    await cleanupConsultations();

    // === STUDENT: Login and log a consultation on Proposal checkpoint ===
    const studentCtx = await browser.newContext();
    const studentPage = await studentCtx.newPage();
    await loginAsRole(studentPage, 'student');

    await navigateToStudentAssignment(studentPage);
    await clickConsultationsTab(studentPage);

    // Fill the ConsultationForm
    await studentPage.locator('button[role="combobox"]').first().click();
    await studentPage.getByRole('option', { name: 'Proposal' }).click();
    await studentPage.locator('textarea').fill('Cross-role lifecycle consultation for proposal.');

    // Submit (button has type="submit")
    await studentPage.locator('button[type="submit"]:has-text("Log Consultation")').click();

    // Verify success toast
    await expect(studentPage.locator('text=Consultation logged successfully')).toBeVisible({
      timeout: 10_000,
    });

    // === INSTRUCTOR: Login and verify the consultation ===
    const instructorCtx = await browser.newContext();
    const instructorPage = await instructorCtx.newPage();
    await loginAsRole(instructorPage, 'instructor');

    await navigateToInstructorAssignment(instructorPage);
    await clickConsultationsTab(instructorPage);

    // Verify the pending consultation appears in the verification queue
    await expect(instructorPage.locator('text=Pending Verification').first()).toBeVisible({
      timeout: 10_000,
    });

    // Click the verification queue item
    await instructorPage.locator('button:has-text("Proposal")').first().click();

    // Wait for verification dialog
    const verifyDialog = instructorPage.getByRole('dialog');
    await expect(verifyDialog).toBeVisible({ timeout: 10_000 });

    // Click "Verify"
    await verifyDialog.getByRole('button', { name: 'Verify' }).click();

    // Verify toast
    await expect(instructorPage.locator('text=Consultation verified successfully')).toBeVisible({
      timeout: 10_000,
    });

    // === DB: Create a submission for Proposal checkpoint ===
    const { submissionId: proposalSubmissionId } = await createSubmissionForCheckpoint('Proposal');

    // === INSTRUCTOR: Review Proposal with Pass ===
    await instructorPage.goto(`/instructor/reviews/${proposalSubmissionId}`);
    await instructorPage.waitForLoadState('networkidle');

    await instructorPage.check('input[name="decision"][value="pass"]');
    await instructorPage.fill('#comment', 'Good work on the proposal!');
    await instructorPage.click('button:has-text("Submit Review")');

    await expect(instructorPage.locator('text=Review submitted successfully!')).toBeVisible({
      timeout: 15_000,
    });

    // === DB: Verify Chapter 1 is now unlocked ===
    const chapter1State = await getCheckpointState('Chapter 1');
    expect(chapter1State).toBe('unlocked');

    // === DB: Create a submission for Chapter 1 ===
    const { submissionId: chapter1SubmissionId } = await createSubmissionForCheckpoint('Chapter 1');

    // === INSTRUCTOR: Review Chapter 1 with Revise ===
    await instructorPage.goto(`/instructor/reviews/${chapter1SubmissionId}`);
    await instructorPage.waitForLoadState('networkidle');

    await instructorPage.check('input[name="decision"][value="revise"]');
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
    await instructorPage.fill('#revisionDeadline', tomorrow);
    await instructorPage.fill('#comment', 'Needs more detail in the methodology section.');
    await instructorPage.click('button:has-text("Submit Review")');

    await expect(instructorPage.locator('text=Review submitted successfully!')).toBeVisible({
      timeout: 15_000,
    });

    // === DB: Verify Chapter 1 is in 'revise' state ===
    const chapter1ReviseState = await getCheckpointState('Chapter 1');
    expect(chapter1ReviseState).toBe('revise');

    // === DB: Create a resubmission for Chapter 1 ===
    const { submissionId: chapter1ResubmissionId } =
      await createSubmissionForCheckpoint('Chapter 1');

    // === INSTRUCTOR: Review Chapter 1 resubmission with Pass ===
    await instructorPage.goto(`/instructor/reviews/${chapter1ResubmissionId}`);
    await instructorPage.waitForLoadState('networkidle');

    await instructorPage.check('input[name="decision"][value="pass"]');
    await instructorPage.fill('#comment', 'Much better, approved!');
    await instructorPage.click('button:has-text("Submit Review")');

    await expect(instructorPage.locator('text=Review submitted successfully!')).toBeVisible({
      timeout: 15_000,
    });

    // === DB: Verify final checkpoint states ===
    const proposalFinalState = await getCheckpointState('Proposal');
    expect(proposalFinalState).toBe('passed');

    const chapter1FinalState = await getCheckpointState('Chapter 1');
    expect(chapter1FinalState).toBe('passed');

    // Chapter 2 should be unlocked after Chapter 1 passes
    const chapter2State = await getCheckpointState('Chapter 2');
    expect(chapter2State).toBe('unlocked');

    // === Cleanup ===
    await studentCtx.close();
    await instructorCtx.close();
  });
});
