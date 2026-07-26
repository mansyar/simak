import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

const STUDENT_EMAIL = 'student@e2e.test';

// ---------------------------------------------------------------------------
// DB Helpers
// ---------------------------------------------------------------------------

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

async function cleanupConsultations(): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  await sql`DELETE FROM consultations`;
  await sql.end();
}

async function createPendingConsultation(
  checkpointName: string,
  studentEmail = STUDENT_EMAIL,
): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const checkpointId = await getCheckpointId(checkpointName, studentEmail);
  const [row] = await sql`
    INSERT INTO consultations (assignment_id, checkpoint_id, student_id, status, notes, session_type)
    VALUES (
      (SELECT id FROM assignments WHERE title = 'E2E Test Assignment' LIMIT 1),
      ${checkpointId},
      (SELECT id FROM users WHERE email = ${studentEmail} LIMIT 1),
      'pending',
      'Test consultation for rejection.',
      'internal'
    )
    RETURNING id
  `;
  await sql.end();
  return row.id;
}

async function getConsultationId(
  checkpointName: string,
  studentEmail = STUDENT_EMAIL,
): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`
    SELECT con.id FROM consultations con
    JOIN checkpoints c ON con.checkpoint_id = c.id
    JOIN users u ON con.student_id = u.id
    WHERE c.name = ${checkpointName} AND u.email = ${studentEmail}
    ORDER BY con.created_at DESC
    LIMIT 1
  `;
  await sql.end();
  if (!row) throw new Error(`Consultation for "${checkpointName}" for ${studentEmail} not found`);
  return row.id;
}

async function getConsultationStatus(consultationId: number): Promise<string> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`SELECT status FROM consultations WHERE id = ${consultationId}`;
  await sql.end();
  if (!row) throw new Error(`Consultation ${consultationId} not found`);
  return row.status;
}

async function verifyConsultationInDb(consultationId: number): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  await sql`
    UPDATE consultations
    SET status = 'verified',
        verified_by_id = (SELECT id FROM users WHERE email = 'instructor@e2e.test'),
        verified_at = NOW()
    WHERE id = ${consultationId}
  `;
  await sql.end();
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
// Tests
// ---------------------------------------------------------------------------

test.describe('Consultation Lifecycle', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'student');
    await ensureAuthFile(browser, 'instructor');
  });

  test('student logs a consultation → instructor verifies → count increments', async ({
    browser,
  }) => {
    await cleanupConsultations();

    // === STUDENT: Log a consultation via the UI ===
    const studentCtx = await browser.newContext({ storageState: getAuthFilePath('student') });
    const studentPage = await studentCtx.newPage();

    await navigateToStudentAssignment(studentPage);
    await clickConsultationsTab(studentPage);

    // Fill the ConsultationForm
    await studentPage.locator('button[role="combobox"]').first().click();
    await studentPage.getByRole('option', { name: 'Proposal' }).click();
    await studentPage.locator('textarea').fill('E2E test consultation notes for verification.');

    // Submit (button has type="submit")
    await studentPage.locator('button[type="submit"]:has-text("Log Consultation")').click();

    // Verify success toast
    await expect(studentPage.locator('text=Consultation logged successfully')).toBeVisible({
      timeout: 10_000,
    });

    // Verify "Pending" badge appears in ConsultationList
    await expect(studentPage.locator('text=Pending').first()).toBeVisible({ timeout: 10_000 });

    // Verify ConsultationProgress summary shows 0/3 (pending doesn't count as verified)
    await expect(studentPage.locator('text=0/3 verified')).toBeVisible({ timeout: 10_000 });

    const consultationId = await getConsultationId('Proposal');

    // === INSTRUCTOR: Verify the consultation via VerificationDialog ===
    const instructorCtx = await browser.newContext({ storageState: getAuthFilePath('instructor') });
    const instructorPage = await instructorCtx.newPage();

    await navigateToInstructorAssignment(instructorPage);
    await clickConsultationsTab(instructorPage);

    // Verify the pending consultation appears in the verification queue
    await expect(instructorPage.locator('text=Pending Verification')).toBeVisible({
      timeout: 10_000,
    });

    // Click the verification queue item (button containing the checkpoint name "Proposal")
    await instructorPage.locator('button:has-text("Proposal")').first().click();

    // Wait for dialog to appear
    const dialog = instructorPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Click "Verify"
    await dialog.getByRole('button', { name: 'Verify' }).click();

    // Verify toast
    await expect(instructorPage.locator('text=Consultation verified successfully')).toBeVisible({
      timeout: 10_000,
    });

    // Verify DB state
    const status = await getConsultationStatus(consultationId);
    expect(status).toBe('verified');

    // === STUDENT: Reload and verify count incremented ===
    await studentPage.reload();
    await studentPage.waitForLoadState('networkidle');
    await clickConsultationsTab(studentPage);

    // ConsultationProgress summary should now show 1/3 verified
    await expect(studentPage.locator('text=1/3 verified')).toBeVisible({ timeout: 10_000 });

    // ConsultationList should show "Verified" badge
    await expect(studentPage.locator('text=Verified').first()).toBeVisible({ timeout: 10_000 });

    await studentCtx.close();
    await instructorCtx.close();
  });

  test('instructor rejects a consultation with reason → rejected badge', async ({ browser }) => {
    await cleanupConsultations();

    // Create a pending consultation via DB
    const consultationId = await createPendingConsultation('Proposal');

    // === INSTRUCTOR: Reject the consultation ===
    const instructorCtx = await browser.newContext({ storageState: getAuthFilePath('instructor') });
    const instructorPage = await instructorCtx.newPage();

    await navigateToInstructorAssignment(instructorPage);
    await clickConsultationsTab(instructorPage);

    // Click the verification queue item (button containing the checkpoint name "Proposal")
    await instructorPage.locator('button:has-text("Proposal")').first().click();

    const dialog = instructorPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Click "Reject" to reveal the reject input
    await dialog.getByRole('button', { name: 'Reject' }).click();

    // Fill in the rejection reason
    await dialog
      .locator('input')
      .fill('The consultation notes are too brief. Please provide more details.');

    // Click "Confirm Reject"
    await dialog.getByRole('button', { name: 'Confirm Reject' }).click();

    // Verify toast
    await expect(instructorPage.locator('text=Consultation rejected successfully')).toBeVisible({
      timeout: 10_000,
    });

    // Verify DB state
    const status = await getConsultationStatus(consultationId);
    expect(status).toBe('rejected');

    // === STUDENT: Verify "Rejected" badge ===
    const studentCtx = await browser.newContext({ storageState: getAuthFilePath('student') });
    const studentPage = await studentCtx.newPage();

    await navigateToStudentAssignment(studentPage);
    await clickConsultationsTab(studentPage);

    // ConsultationList should show "Rejected" badge
    await expect(studentPage.locator('text=Rejected').first()).toBeVisible({ timeout: 10_000 });

    await studentCtx.close();
    await instructorCtx.close();
  });

  test('consultation gating UI shows blocking reasons and count update', async ({ browser }) => {
    await cleanupConsultations();

    const studentCtx = await browser.newContext({ storageState: getAuthFilePath('student') });
    const studentPage = await studentCtx.newPage();

    await navigateToStudentAssignment(studentPage);

    // Default tab is 'timeline' — verify blocking reasons on locked checkpoints
    // Chapter 1 is locked (Proposal not passed) with minConsultations: 1, verifiedCount: 0
    await expect(studentPage.locator('text=Previous checkpoint not passed').first()).toBeVisible({
      timeout: 10_000,
    });

    await expect(
      studentPage.locator('text=Insufficient consultations: 0/1 verified').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Proposal checkpoint shows "Consultations: 0/1"
    await expect(studentPage.locator('text=Consultations: 0/1').first()).toBeVisible({
      timeout: 10_000,
    });

    // === Verify a consultation on Proposal via DB ===
    const consultationId = await createPendingConsultation('Proposal');
    await verifyConsultationInDb(consultationId);

    // Reload to reflect updated count
    await studentPage.reload();
    await studentPage.waitForLoadState('networkidle');

    // Proposal checkpoint should now show "Consultations: 1/1"
    await expect(studentPage.locator('text=Consultations: 1/1').first()).toBeVisible({
      timeout: 10_000,
    });

    await studentCtx.close();
  });
});
