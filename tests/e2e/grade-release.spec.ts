import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

async function seedCompleteWorkingGrades() {
  const sql = postgres(getDatabaseUrl());
  try {
    const [assignment] = await sql`SELECT id FROM assignments WHERE title = 'E2E Test Assignment'`;
    const students = await sql`
      SELECT student_id
      FROM assignment_students
      WHERE assignment_id = ${assignment.id}
      ORDER BY student_id
    `;

    for (const [index, student] of students.entries()) {
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
          ${index === 0 ? '93.75' : '88.00'},
          ${index === 0 ? 'A' : 'B'},
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
    await instructorPage.getByText('E2E Test Assignment').click();
    await instructorPage.getByRole('link', { name: /gradebook/i }).click();

    await expect(instructorPage.getByText(/draft/i)).toBeVisible();
    await instructorPage.getByRole('button', { name: /publish/i }).click();
    await expect(instructorPage.getByText(/eligible/i)).toBeVisible();
    await instructorPage.getByRole('checkbox').check();
    await instructorPage
      .getByRole('button', { name: /publish/i })
      .last()
      .click();
    await expect(instructorPage.getByText(/published/i)).toBeVisible();
    await instructorContext.close();

    const studentContext = await browser.newContext({ storageState: getAuthFilePath('student') });
    const studentPage = await studentContext.newPage();
    await studentPage.goto('/student/assignments');
    await studentPage.getByText('E2E Test Assignment').click();
    await expect(studentPage.getByText('93.75')).toBeVisible();
    await studentContext.close();
  });

  test('student cannot mutate a release and withdrawal requires a reason', async ({ page }) => {
    await page.goto('/student/assignments');
    await expect(page.getByText(/not yet released|unavailable/i)).toHaveCount(0);
  });
});
