import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

async function prepareRevisionCheckpoint(): Promise<{
  assignmentId: number;
  checkpointId: number;
  submissionId: number;
}> {
  const sql = postgres(getDatabaseUrl());
  const [checkpoint] = await sql`
    SELECT c.id, c.assignment_id
    FROM checkpoints c
    JOIN users u ON c.student_id = u.id
    WHERE c.name = 'Chapter 1' AND u.email = 'student@e2e.test'
  `;
  if (!checkpoint) throw new Error('Chapter 1 checkpoint was not seeded');

  await sql`DELETE FROM reviews WHERE submission_id IN (
    SELECT id FROM submissions WHERE checkpoint_id = ${checkpoint.id}
  )`;
  await sql`DELETE FROM submissions WHERE checkpoint_id = ${checkpoint.id}`;

  const [submission] = await sql`
    INSERT INTO submissions (checkpoint_id, uploaded_by, file_key, file_name, file_size, version)
    VALUES (
      ${checkpoint.id},
      (SELECT id FROM users WHERE email = 'student@e2e.test'),
      ${`e2e-revision-plan-${Date.now()}.pdf`},
      'revision-plan.pdf',
      1024,
      1
    )
    RETURNING id
  `;
  await sql`UPDATE checkpoints SET state = 'submitted' WHERE id = ${checkpoint.id}`;

  const [instructor] = await sql`
    SELECT id FROM users WHERE email = 'instructor@e2e.test'
  `;
  const [historyReview] = await sql`
    INSERT INTO reviews (submission_id, instructor_id, decision, comment, created_at, reviewed_at)
    VALUES (
      ${submission.id}, ${instructor.id}, 'revise', 'Earlier guidance',
      NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
    )
    RETURNING id
  `;
  await sql`
    INSERT INTO revision_action_items (review_id, item_text, "order")
    VALUES (${historyReview.id}, 'Historical item', 0)
  `;
  await sql.end();

  return {
    assignmentId: checkpoint.assignment_id,
    checkpointId: checkpoint.id,
    submissionId: submission.id,
  };
}

async function createResubmission(checkpointId: number): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const [submission] = await sql`
    INSERT INTO submissions (checkpoint_id, uploaded_by, file_key, file_name, file_size, version)
    VALUES (
      ${checkpointId},
      (SELECT student_id FROM checkpoints WHERE id = ${checkpointId}),
      ${`e2e-revision-plan-resubmission-${Date.now()}.pdf`},
      'revision-plan-resubmission.pdf',
      2048,
      2
    )
    RETURNING id
  `;
  await sql`UPDATE checkpoints SET state = 'submitted' WHERE id = ${checkpointId}`;
  await sql.end();
  return submission.id;
}

async function getLatestFixture(): Promise<{
  assignmentId: number;
  checkpointId: number;
  submissionId: number;
}> {
  const sql = postgres(getDatabaseUrl());
  const [fixture] = await sql`
    SELECT c.assignment_id, c.id AS checkpoint_id, s.id AS submission_id
    FROM checkpoints c
    JOIN users u ON u.id = c.student_id
    JOIN LATERAL (
      SELECT id FROM submissions
      WHERE checkpoint_id = c.id
      ORDER BY version DESC
      LIMIT 1
    ) s ON true
    WHERE c.name = 'Chapter 1' AND u.email = 'student@e2e.test'
  `;
  await sql.end();
  if (!fixture) throw new Error('Revision checkpoint fixture was not found');
  return {
    assignmentId: fixture.assignment_id,
    checkpointId: fixture.checkpoint_id,
    submissionId: fixture.submission_id,
  };
}

test.describe('Revision action plan lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await Promise.all([ensureAuthFile(browser, 'instructor'), ensureAuthFile(browser, 'student')]);
  });

  test('instructor creates a plan and student addresses it without blocking resubmission', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const { assignmentId, checkpointId, submissionId } = await prepareRevisionCheckpoint();

    const instructorContext = await browser.newContext({
      storageState: getAuthFilePath('instructor'),
    });
    const instructorPage = await instructorContext.newPage();
    await instructorPage.goto(`/instructor/reviews/${submissionId}`);
    await instructorPage.waitForLoadState('networkidle');

    await instructorPage.check('input[name="decision"][value="revise"]');
    await instructorPage.fill(
      '#revisionDeadline',
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    );
    await instructorPage.fill('#comment', 'Please address these ordered items.');
    await instructorPage.getByRole('button', { name: 'Add action item' }).click();
    await instructorPage
      .locator('textarea[id^="revision-action-item-"]')
      .first()
      .fill('Clarify the methodology');
    await instructorPage.getByRole('button', { name: 'Add action item' }).click();
    await instructorPage
      .locator('textarea[id^="revision-action-item-"]')
      .nth(1)
      .fill('Add supporting sources');
    await instructorPage.getByRole('button', { name: 'Submit Review' }).click();
    await expect(instructorPage.getByText('Review submitted successfully!')).toBeVisible();

    const sql = postgres(getDatabaseUrl());
    const [plan] = await sql`
      SELECT r.id
      FROM reviews r
      JOIN submissions s ON s.id = r.submission_id
      WHERE s.checkpoint_id = ${checkpointId} AND r.decision = 'revise'
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 1
    `;
    const planItems = await sql`
      SELECT item_text, "order"
      FROM revision_action_items
      WHERE review_id = ${plan.id}
      ORDER BY "order"
    `;
    expect(planItems).toEqual([
      { item_text: 'Clarify the methodology', order: 0 },
      { item_text: 'Add supporting sources', order: 1 },
    ]);
    const [notification] = await sql`
      SELECT type FROM notifications
      WHERE user_id = (SELECT id FROM users WHERE email = 'student@e2e.test')
        AND type = 'revision_requested'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(notification?.type).toBe('revision_requested');
    await sql.end();
    await instructorContext.close();

    const studentContext = await browser.newContext({ storageState: getAuthFilePath('student') });
    const studentPage = await studentContext.newPage();
    await studentPage.goto('/student/dashboard');
    await studentPage.waitForLoadState('networkidle');
    await expect(studentPage.getByText('Clarify the methodology')).toBeVisible();
    await expect(studentPage.getByText('2 revision item(s) remain')).toBeVisible();

    await studentPage.goto(`/student/assignments/${assignmentId}/checkpoints/${checkpointId}`);
    await studentPage.waitForLoadState('networkidle');

    await expect(studentPage.getByText('Current revision plan')).toBeVisible();
    await expect(studentPage.getByText('Previous revision plan')).toBeVisible();
    await expect(studentPage.getByText('Clarify the methodology')).toBeVisible();
    await expect(studentPage.getByText('Add supporting sources')).toBeVisible();
    await expect(studentPage.getByText('Historical item')).toBeVisible();

    const firstItem = studentPage.getByRole('checkbox', { name: 'Action item 1' });
    await expect(firstItem).not.toBeChecked();
    await firstItem.check();
    await expect(firstItem).toBeChecked();
    await expect(studentPage.getByText('Addressed').first()).toBeVisible();

    await expect(studentPage.getByText('Drop your file here or click to browse')).toBeVisible();
    await studentContext.close();

    const resubmissionId = await createResubmission(checkpointId);
    const secondInstructorContext = await browser.newContext({
      storageState: getAuthFilePath('instructor'),
    });
    const secondInstructorPage = await secondInstructorContext.newPage();
    await secondInstructorPage.goto(`/instructor/reviews/${resubmissionId}`);
    await secondInstructorPage.waitForLoadState('networkidle');
    await secondInstructorPage.check('input[name="decision"][value="revise"]');
    await secondInstructorPage.fill(
      '#revisionDeadline',
      new Date(Date.now() + 172_800_000).toISOString().slice(0, 10),
    );
    await secondInstructorPage.fill('#comment', 'Please address the new evidence request.');
    await secondInstructorPage.getByRole('button', { name: 'Add action item' }).click();
    await secondInstructorPage
      .locator('textarea[id^="revision-action-item-"]')
      .first()
      .fill('Add an experiment');
    await secondInstructorPage.getByRole('button', { name: 'Submit Review' }).click();
    await expect(secondInstructorPage.getByText('Review submitted successfully!')).toBeVisible();
    await secondInstructorContext.close();

    const refreshedStudentContext = await browser.newContext({
      storageState: getAuthFilePath('student'),
    });
    const refreshedStudentPage = await refreshedStudentContext.newPage();
    await refreshedStudentPage.goto(
      `/student/assignments/${assignmentId}/checkpoints/${checkpointId}`,
    );
    await refreshedStudentPage.waitForLoadState('networkidle');
    await expect(refreshedStudentPage.getByText('Add an experiment')).toBeVisible();
    await expect(refreshedStudentPage.getByText('Clarify the methodology')).toBeVisible();
    await expect(refreshedStudentPage.getByText('Previous revision plan')).toHaveCount(2);
    await refreshedStudentContext.close();
  });

  test('revision plan surfaces have no critical or serious accessibility violations', async ({
    browser,
  }) => {
    const { assignmentId, checkpointId, submissionId } = await getLatestFixture();
    const studentContext = await browser.newContext({ storageState: getAuthFilePath('student') });
    const studentPage = await studentContext.newPage();
    await studentPage.goto(`/student/assignments/${assignmentId}/checkpoints/${checkpointId}`);
    await studentPage.waitForLoadState('networkidle');
    await expect(studentPage.getByText('Current revision plan')).toBeVisible();
    const studentA11y = await new AxeBuilder({ page: studentPage }).analyze();
    expect(
      studentA11y.violations.filter((violation) =>
        ['critical', 'serious'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
    await studentContext.close();

    const instructorContext = await browser.newContext({
      storageState: getAuthFilePath('instructor'),
    });
    const instructorPage = await instructorContext.newPage();
    await instructorPage.goto(`/instructor/reviews/${submissionId}`);
    await instructorPage.waitForLoadState('networkidle');
    await expect(instructorPage.getByText('Add an experiment')).toBeVisible();
    const instructorA11y = await new AxeBuilder({ page: instructorPage }).analyze();
    expect(
      instructorA11y.violations.filter((violation) =>
        ['critical', 'serious'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
    await instructorContext.close();
  });

  test('current revision plan remains usable at a 320px viewport', async ({ browser }) => {
    const { assignmentId, checkpointId } = await getLatestFixture();
    const context = await browser.newContext({
      storageState: getAuthFilePath('student'),
      viewport: { width: 320, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(`/student/assignments/${assignmentId}/checkpoints/${checkpointId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Current revision plan')).toBeVisible();
    const hasNoHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(hasNoHorizontalOverflow).toBe(true);
    await context.close();
  });
});
