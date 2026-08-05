import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

const STUDENT_EMAIL = 'student@e2e.test';

// === DB Helpers ===

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

async function cleanupExtensionRequests(): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  await sql`DELETE FROM extension_requests`;
  await sql.end();
}

async function createExtensionRequest(
  checkpointName: string,
  studentEmail = STUDENT_EMAIL,
  category = 'research',
  reason = 'Need more time for data collection.',
  days = 3,
): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const checkpointId = await getCheckpointId(checkpointName, studentEmail);
  const requestedDeadline = new Date();
  requestedDeadline.setDate(requestedDeadline.getDate() + days);
  const [row] = await sql`
    INSERT INTO extension_requests (assignment_id, student_id, checkpoint_id, category, reason, extension_days, status, requested_deadline)
    SELECT a.id, u.id, ${checkpointId}, ${category}, ${reason}, ${days}, 'pending', ${requestedDeadline}
    FROM assignments a, users u
    WHERE a.title = 'E2E Test Assignment' AND u.email = ${studentEmail}
    RETURNING id
  `;
  await sql.end();
  return row.id;
}

async function getExtensionRequestId(
  checkpointName: string,
  studentEmail = STUDENT_EMAIL,
): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`
    SELECT er.id FROM extension_requests er
    JOIN checkpoints c ON er.checkpoint_id = c.id
    JOIN users u ON er.student_id = u.id
    WHERE c.name = ${checkpointName} AND u.email = ${studentEmail}
    ORDER BY er.created_at DESC
    LIMIT 1
  `;
  await sql.end();
  if (!row)
    throw new Error(`Extension request for "${checkpointName}" for ${studentEmail} not found`);
  return row.id;
}

async function getExtensionRequestStatus(requestId: number): Promise<string> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`SELECT status FROM extension_requests WHERE id = ${requestId}`;
  await sql.end();
  if (!row) throw new Error(`Extension request ${requestId} not found`);
  return row.status;
}

async function getCheckpointDueDate(
  checkpointName: string,
  studentEmail = STUDENT_EMAIL,
): Promise<Date | null> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`
    SELECT c.due_date FROM checkpoints c
    JOIN users u ON c.student_id = u.id
    WHERE c.name = ${checkpointName} AND u.email = ${studentEmail}
  `;
  await sql.end();
  return row?.due_date ?? null;
}

async function setCheckpointDueDate(
  checkpointName: string,
  dueDate: Date,
  studentEmail = STUDENT_EMAIL,
): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  await sql`
    UPDATE checkpoints SET due_date = ${dueDate}
    WHERE name = ${checkpointName} AND student_id = (
      SELECT id FROM users WHERE email = ${studentEmail}
    )
  `;
  await sql.end();
}

// === Navigation Helpers ===

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

// === Tests ===

test.describe('Extension Request Lifecycle', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'student');
    await ensureAuthFile(browser, 'instructor');
  });

  test('student submits extension request → instructor approves → dueDate extended', async ({
    browser,
  }) => {
    await cleanupExtensionRequests();

    // === STUDENT: Submit extension request via UI ===
    const studentCtx = await browser.newContext({ storageState: getAuthFilePath('student') });
    const studentPage = await studentCtx.newPage();

    await navigateToStudentAssignment(studentPage);

    // Click "Request Deadline Extension" tab
    await studentPage.click('button:has-text("Request Deadline Extension")');
    await studentPage.waitForLoadState('networkidle');

    // Fill ExtensionRequestForm (field order: Category → Reason → Duration → Checkpoint)
    // Select category (first combobox) — "Research"
    await studentPage.locator('button[role="combobox"]').first().click();
    await studentPage.getByRole('option', { name: 'Research' }).click();

    // Fill reason (textarea, min 10 chars)
    await studentPage
      .getByRole('textbox', { name: 'Reason' })
      .fill('Need more time for data collection and analysis.');

    // Fill duration (spinbutton)
    await studentPage.getByRole('spinbutton', { name: 'Duration (days)' }).fill('3');

    // Select checkpoint (second combobox) — "Proposal"
    await studentPage.locator('button[role="combobox"]').nth(1).click();
    await studentPage.getByRole('option', { name: 'Proposal' }).click();

    // Submit
    await studentPage.click('button[type="submit"]:has-text("Submit Request")');

    // Verify "Pending" badge in Extension History (success toast may auto-dismiss)
    await expect(studentPage.locator('text=Pending').first()).toBeVisible({ timeout: 10_000 });

    // Get extension request ID from DB
    const requestId = await getExtensionRequestId('Proposal');

    // Record original checkpoint dueDate (seed sets a dueDate for each checkpoint)
    const originalDueDate = await getCheckpointDueDate('Proposal');
    expect(originalDueDate).not.toBeNull();

    // === INSTRUCTOR: Approve extension request ===
    const instructorCtx = await browser.newContext({ storageState: getAuthFilePath('instructor') });
    const instructorPage = await instructorCtx.newPage();

    await navigateToInstructorAssignment(instructorPage);

    // Click "Extension Requests" tab
    await instructorPage.click('button:has-text("Extension Requests")');
    await instructorPage.waitForLoadState('networkidle');

    // Click "Approve" button on the pending request
    await instructorPage.locator('button:has-text("Approve")').first().click();

    // Dialog opens — click "Approve Extension" confirm button
    const dialog = instructorPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: 'Approve Extension' }).click();

    // Verify toast success
    await expect(instructorPage.locator('text=Extension approved successfully')).toBeVisible({
      timeout: 10_000,
    });

    // Verify DB: status = 'approved'
    const status = await getExtensionRequestStatus(requestId);
    expect(status).toBe('approved');

    // Verify DB: checkpoint dueDate extended (new date is later than original)
    const newDueDate = await getCheckpointDueDate('Proposal');
    expect(newDueDate).not.toBeNull();
    if (newDueDate && originalDueDate) {
      expect(newDueDate.getTime()).toBeGreaterThan(originalDueDate.getTime());
    }

    // === STUDENT: Verify "Approved" badge ===
    await studentPage.reload();
    await studentPage.waitForLoadState('networkidle');

    // Click "Request Deadline Extension" tab
    await studentPage.click('button:has-text("Request Deadline Extension")');
    await studentPage.waitForLoadState('networkidle');

    // Verify "Approved" badge
    await expect(studentPage.locator('text=Approved').first()).toBeVisible({ timeout: 10_000 });

    await studentCtx.close();
    await instructorCtx.close();
  });

  test('instructor rejects extension with reason → rejected badge → deadline NOT extended', async ({
    browser,
  }) => {
    await cleanupExtensionRequests();

    // Create extension request via DB
    const requestId = await createExtensionRequest('Proposal');

    // Set a known dueDate for the checkpoint (so we can verify it's NOT changed)
    const knownDate = new Date('2026-08-15T12:00:00Z');
    await setCheckpointDueDate('Proposal', knownDate);

    // === INSTRUCTOR: Reject extension request ===
    const instructorCtx = await browser.newContext({ storageState: getAuthFilePath('instructor') });
    const instructorPage = await instructorCtx.newPage();

    await navigateToInstructorAssignment(instructorPage);

    // Click "Extension Requests" tab
    await instructorPage.click('button:has-text("Extension Requests")');
    await instructorPage.waitForLoadState('networkidle');

    // Click "Reject" button on the pending request
    await instructorPage.locator('button:has-text("Reject")').first().click();

    // Dialog opens — fill reject reason (min 20 chars)
    const dialog = instructorPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog
      .locator('#reject-reason')
      .fill('The reason provided is not sufficient for an extension.');

    // Click "Reject Extension" confirm button
    await dialog.getByRole('button', { name: 'Reject Extension' }).click();

    // Verify toast success
    await expect(instructorPage.locator('text=Extension rejected successfully')).toBeVisible({
      timeout: 10_000,
    });

    // Verify DB: status = 'rejected'
    const status = await getExtensionRequestStatus(requestId);
    expect(status).toBe('rejected');

    // Verify DB: checkpoint dueDate NOT extended (still the same known date)
    const dueDateAfter = await getCheckpointDueDate('Proposal');
    expect(dueDateAfter).not.toBeNull();
    if (dueDateAfter) {
      expect(dueDateAfter.toDateString()).toBe(knownDate.toDateString());
    }

    // === STUDENT: Verify "Rejected" badge ===
    const studentCtx = await browser.newContext({ storageState: getAuthFilePath('student') });
    const studentPage = await studentCtx.newPage();

    await navigateToStudentAssignment(studentPage);

    // Click "Request Deadline Extension" tab
    await studentPage.click('button:has-text("Request Deadline Extension")');
    await studentPage.waitForLoadState('networkidle');

    // Verify "Rejected" badge
    await expect(studentPage.locator('text=Rejected').first()).toBeVisible({ timeout: 10_000 });

    await studentCtx.close();
    await instructorCtx.close();
  });

  test('instructor extends checkpoint deadline via DeadlineManager', async ({ browser }) => {
    // Get Proposal checkpoint ID for targeted selector
    const proposalId = await getCheckpointId('Proposal');

    const instructorCtx = await browser.newContext({ storageState: getAuthFilePath('instructor') });
    const instructorPage = await instructorCtx.newPage();

    await navigateToInstructorAssignment(instructorPage);

    // Overview tab is default — expand first student section in DeadlineManager
    // Use email to avoid matching "Export Student Progress" button
    await instructorPage.locator('button:has-text("student@e2e.test")').first().click();

    // Find Proposal's date input
    const dateInput = instructorPage.locator(`[data-testid="extend-deadline-input-${proposalId}"]`);
    await expect(dateInput).toBeVisible({ timeout: 10_000 });

    // Set a new date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await dateInput.fill(dateStr);
    await expect(dateInput).toHaveValue(dateStr);

    // Click "Extend" button
    await dateInput.locator('xpath=..').getByRole('button', { name: 'Extend' }).click();
    await expect(instructorPage.getByText('Deadline extended successfully')).toBeVisible({
      timeout: 10_000,
    });

    // Verify DB: checkpoint dueDate updated
    const newDueDate = await getCheckpointDueDate('Proposal');
    expect(newDueDate).not.toBeNull();
    expect(newDueDate!.toDateString()).toBe(tomorrow.toDateString());

    await instructorCtx.close();
  });
});
