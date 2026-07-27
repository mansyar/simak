import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { loginAsRole } from './helpers/auth';

test.beforeAll(async () => {
  await resetDatabase();
});

async function getAssignmentId(): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`SELECT id FROM assignments WHERE deleted_at IS NULL LIMIT 1`;
  await sql.end();
  return row?.id;
}

async function getStudentId(): Promise<string> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`SELECT id FROM users WHERE email = 'student@e2e.test' LIMIT 1`;
  await sql.end();
  return row?.id;
}

async function getCheckpointId(name: string): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`
    SELECT c.id FROM checkpoints c
    JOIN users u ON c.student_id = u.id
    WHERE c.name = ${name} AND u.email = 'student@e2e.test'
    LIMIT 1
  `;
  await sql.end();
  return row?.id;
}

async function createSubmissionForA11y(checkpointName: string): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const studentId = await getStudentId();
  const checkpointId = await getCheckpointId(checkpointName);

  await sql`DELETE FROM review_scores WHERE review_id IN (SELECT id FROM reviews WHERE submission_id IN (SELECT id FROM submissions WHERE checkpoint_id = ${checkpointId}))`;
  await sql`DELETE FROM reviews WHERE submission_id IN (SELECT id FROM submissions WHERE checkpoint_id = ${checkpointId})`;
  await sql`DELETE FROM submissions WHERE checkpoint_id = ${checkpointId}`;

  const [submission] = await sql`
    INSERT INTO submissions (checkpoint_id, uploaded_by, file_key, file_name, file_size)
    VALUES (${checkpointId}, ${studentId}, 'e2e-test-file.pdf', 'e2e-test-file.pdf', 1024)
    RETURNING id
  `;
  await sql`UPDATE checkpoints SET state = 'submitted' WHERE id = ${checkpointId}`;
  await sql.end();
  return submission.id;
}

function filterCriticalAndSerious(violations: Array<{ impact?: string }>) {
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

test.describe('Axe Accessibility Scans', () => {
  test('login page has no critical/serious a11y violations', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).analyze();
    expect(filterCriticalAndSerious(results.violations)).toEqual([]);
  });

  test('student dashboard has no critical/serious a11y violations', async ({ page }) => {
    await loginAsRole(page, 'student');

    const results = await new AxeBuilder({ page }).analyze();
    expect(filterCriticalAndSerious(results.violations)).toEqual([]);
  });

  test('student assignment detail has no critical/serious a11y violations', async ({ page }) => {
    const assignmentId = await getAssignmentId();
    await loginAsRole(page, 'student');
    await page.goto(`/student/assignments/${assignmentId}`);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).analyze();
    expect(filterCriticalAndSerious(results.violations)).toEqual([]);
  });

  test('instructor review detail has no critical/serious a11y violations', async ({ page }) => {
    const submissionId = await createSubmissionForA11y('Proposal');
    await loginAsRole(page, 'instructor');
    await page.goto(`/instructor/reviews/${submissionId}`);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).analyze();
    expect(filterCriticalAndSerious(results.violations)).toEqual([]);
  });

  test('admin users page has no critical/serious a11y violations', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).analyze();
    expect(filterCriticalAndSerious(results.violations)).toEqual([]);
  });

  test('admin templates page has no critical/serious a11y violations', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await page.goto('/admin/templates');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).analyze();
    expect(filterCriticalAndSerious(results.violations)).toEqual([]);
  });
});
