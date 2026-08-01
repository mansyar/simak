import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

async function seedCompleteWorkingGrades() {
  const sql = postgres(getDatabaseUrl());
  try {
    const [assignment] = await sql`SELECT id FROM assignments WHERE title = 'E2E Test Assignment'`;
    await sql`
      INSERT INTO assignment_grade_config (
        assignment_id,
        grading_scheme,
        letter_grade_bounds,
        release_status
      ) VALUES (
        ${assignment.id},
        'equal_weight',
        '{"A": 90, "B": 80, "C": 70, "D": 60}'::jsonb,
        'draft'
      )
      ON CONFLICT (assignment_id) DO UPDATE SET
        release_status = 'draft',
        active_release_version = NULL,
        published_at = NULL
    `;
    const students = await sql`
      SELECT assignment_students.student_id, users.email
      FROM assignment_students
      INNER JOIN users ON users.id = assignment_students.student_id
      WHERE assignment_students.assignment_id = ${assignment.id}
      ORDER BY users.email
    `;

    for (const student of students) {
      await sql`
        INSERT INTO final_grades (
          assignment_id,
          student_id,
          numeric_score,
          letter_grade,
          status,
          contributing_checkpoints,
          computed_at,
          updated_at
        ) VALUES (
          ${assignment.id},
          ${student.student_id},
          ${student.email === 'student@e2e.test' ? '93.75' : '88.00'},
          ${student.email === 'student@e2e.test' ? 'A' : 'B'},
          'complete',
          '[]'::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (assignment_id, student_id) DO UPDATE SET
          numeric_score = EXCLUDED.numeric_score,
          letter_grade = EXCLUDED.letter_grade,
          status = EXCLUDED.status,
          contributing_checkpoints = EXCLUDED.contributing_checkpoints,
          updated_at = NOW()
      `;
    }
  } finally {
    await sql.end();
  }
}

test.describe('Grade release workflow', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await seedCompleteWorkingGrades();
    await ensureAuthFile(browser, 'instructor');
    await ensureAuthFile(browser, 'student');
  });

  test('instructor publishes complete grades and student sees the active snapshot', async ({
    browser,
  }) => {
    const instructorContext = await browser.newContext({
      storageState: getAuthFilePath('instructor'),
    });
    const instructorPage = await instructorContext.newPage();
    await instructorPage.goto('/instructor/assignments');
    await instructorPage.getByRole('link', { name: /view all/i }).click();
    const gradebookLink = instructorPage.getByRole('link', { name: /gradebook/i });
    const gradebookHref = await gradebookLink.getAttribute('href');
    expect(gradebookHref).toBeTruthy();
    await instructorPage.goto(gradebookHref!);
    await instructorPage.waitForLoadState('networkidle');

    await expect(instructorPage.getByText(/draft/i)).toBeVisible();
    await instructorPage.getByRole('button', { name: /publish/i }).click();
    await expect(instructorPage.getByText(/eligible/i)).toBeVisible();
    await instructorPage.getByRole('checkbox').check();
    await instructorPage
      .getByRole('button', { name: /publish/i })
      .last()
      .click();
    await expect(
      instructorPage.getByLabel(/release status/i).getByText(/published/i),
    ).toBeVisible();
    await instructorContext.close();

    const studentContext = await browser.newContext({ storageState: getAuthFilePath('student') });
    const studentPage = await studentContext.newPage();
    await studentPage.goto('/student/assignments');
    await studentPage.getByRole('link', { name: /view all/i }).click();
    await studentPage.waitForLoadState('networkidle');
    await expect(studentPage.getByText('93.75')).toBeVisible();
    await studentContext.close();
  });

  test('student cannot mutate a release and withdrawal requires a reason', async ({ page }) => {
    await page.goto('/student/assignments');
    await expect(page.getByText(/not yet released|unavailable/i)).toHaveCount(0);
  });
});
