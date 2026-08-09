import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';
import { getDatabaseUrl, resetDatabase } from './helpers/db-reset';
import {
  installMockDownloadRoute,
  mockReportingServerFns,
  type CapturedReportRequest,
} from './helpers/reporting-mocks';

const SECTION_A_LABEL = 'E2E-THESIS - A - E2E Thesis Section';
const SECTION_B_LABEL = 'E2E-THESIS - B - E2E Negative Fixture Section';

const REPORT_TITLES = {
  institutional: 'Institutional Academic Summary',
  analytics: 'Analytics Summary',
  transcript: 'Official Transcript',
} as const;

const SECRET_ARTIFACT_KEY = 'reports/e2e-secret-artifact-key.pdf';

type E2EDb = postgres.Sql<{}>;

async function openDb(): Promise<E2EDb> {
  return postgres(getDatabaseUrl());
}

async function getSectionId(sql: E2EDb, code: string, name: string): Promise<number> {
  const [row] = await sql<{ id: number }[]>`
    SELECT id FROM course_sections WHERE code = ${code} AND name = ${name} LIMIT 1
  `;
  if (!row) throw new Error(`Section not found: ${code} ${name}`);
  return row.id;
}

async function getUserId(sql: E2EDb, email: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  if (!row) throw new Error(`User not found: ${email}`);
  return row.id;
}

async function insertJob(
  sql: E2EDb,
  opts: {
    requesterEmail: string;
    reportType: string;
    state: 'completed' | 'expired';
    artifactKey: string | null;
  },
): Promise<number> {
  const requesterId = await getUserId(sql, opts.requesterEmail);
  const completedAt = new Date(Date.now() - 1000).toISOString();
  const startedAt = new Date(Date.now() - 2000).toISOString();
  const expiresAt =
    opts.state === 'expired'
      ? new Date(Date.now() - 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const [job] = await sql<{ id: number }[]>`
    INSERT INTO report_jobs (
      report_type, requester_id, parameters, locale, state, attempts,
      artifact_key, artifact_size_bytes, artifact_sha256,
      started_at, completed_at, expires_at
    ) VALUES (
      ${opts.reportType}, ${requesterId},
      ${'{"termId":null,"courseId":null,"sectionId":null,"cohort":null}'},
      'en', ${opts.state}, 1,
      ${opts.state === 'completed' ? opts.artifactKey : null},
      ${opts.state === 'completed' ? 2048 : null},
      ${opts.state === 'completed' ? 'e2e-mock-sha256' : null},
      ${startedAt}, ${completedAt}, ${expiresAt}
    ) RETURNING id
  `;
  if (!job) throw new Error('Failed to insert report job');
  return job.id;
}

async function openSectionFilter(cardName: string, page: import('@playwright/test').Page) {
  const card = page.getByRole('region', { name: cardName });
  await card.getByRole('combobox', { name: 'Course section' }).click();
}

test.describe('Reporting E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await resetDatabase();
  });

  test.describe('Admin — institutional summary', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'admin');
    });
    test.use({ storageState: getAuthFilePath('admin') });

    test('catalog exposes all report types with full section scope', async ({ page }) => {
      await page.goto('/admin/reports');
      await expect(page.getByRole('region', { name: REPORT_TITLES.institutional })).toBeVisible();
      await expect(page.getByRole('region', { name: REPORT_TITLES.transcript })).toBeVisible();
      await expect(page.getByRole('region', { name: REPORT_TITLES.analytics })).toBeVisible();

      await openSectionFilter(REPORT_TITLES.institutional, page);
      await expect(page.getByRole('option', { name: SECTION_A_LABEL })).toBeVisible();
      await expect(page.getByRole('option', { name: SECTION_B_LABEL })).toBeVisible();
    });

    test('generates an institutional summary and reports success', async ({ page }) => {
      await mockReportingServerFns(page);
      await page.goto('/admin/reports');
      const card = page.getByRole('region', { name: REPORT_TITLES.institutional });
      await card.getByRole('button', { name: 'Generate report' }).click();
      await expect(page.getByText('Report generated successfully.')).toBeVisible();
    });

    test('downloads via a short-lived server URL without leaking the artifact key', async ({
      page,
    }) => {
      const sql = await openDb();
      try {
        await insertJob(sql, {
          requesterEmail: 'admin@e2e.test',
          reportType: 'institutional_academic_summary',
          state: 'completed',
          artifactKey: SECRET_ARTIFACT_KEY,
        });
      } finally {
        await sql.end();
      }
      installMockDownloadRoute(page);
      await mockReportingServerFns(page);
      await page.goto('/admin/reports');

      const item = page.locator('li', { hasText: REPORT_TITLES.institutional }).first();
      await expect(item.getByText('Completed')).toBeVisible();

      const popupPromise = page.waitForEvent('popup');
      await item.getByRole('button', { name: 'Download' }).click();
      const popup = await popupPromise;
      await popup.waitForURL('**/mock-report-download**');

      const downloadUrl = popup.url();
      expect(downloadUrl).toContain('/mock-report-download');
      expect(downloadUrl).toContain('expires=');
      expect(downloadUrl).not.toContain(SECRET_ARTIFACT_KEY);
      await popup.close();
    });
  });

  test.describe('Instructor — scope enforcement', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'instructor');
    });
    test.use({ storageState: getAuthFilePath('instructor') });

    test('catalog exposes only analytics summary', async ({ page }) => {
      await page.goto('/instructor/reports');
      await expect(page.getByRole('region', { name: REPORT_TITLES.analytics })).toBeVisible();
      await expect(page.getByRole('region', { name: REPORT_TITLES.institutional })).toHaveCount(0);
      await expect(page.getByRole('region', { name: REPORT_TITLES.transcript })).toHaveCount(0);
    });

    test('section filter excludes sections outside enrollment', async ({ page }) => {
      await page.goto('/instructor/reports');
      await openSectionFilter(REPORT_TITLES.analytics, page);
      await expect(page.getByRole('option', { name: SECTION_A_LABEL })).toBeVisible();
      await expect(page.getByRole('option', { name: SECTION_B_LABEL })).toHaveCount(0);
    });

    test('generates a report for an enrolled section only', async ({ page }) => {
      const sql = await openDb();
      let sectionAId: number;
      try {
        sectionAId = await getSectionId(sql, 'A', 'E2E Thesis Section');
      } finally {
        await sql.end();
      }

      const captured: CapturedReportRequest[] = [];
      await mockReportingServerFns(page, captured);
      await page.goto('/instructor/reports');

      await openSectionFilter(REPORT_TITLES.analytics, page);
      await page.getByRole('option', { name: SECTION_A_LABEL }).click();

      const card = page.getByRole('region', { name: REPORT_TITLES.analytics });
      await card.getByRole('button', { name: 'Generate report' }).click();
      await expect(page.getByText('Report generated successfully.')).toBeVisible();

      const request = captured.find((entry) => entry.kind === 'requestReport');
      expect(request).toBeDefined();
      expect(request!.body).toContain('analytics_summary');
      expect(request!.body).toContain(String(sectionAId));
    });
  });

  test.describe('Student — self transcript', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'student');
    });
    test.use({ storageState: getAuthFilePath('student') });

    test('catalog exposes only the official transcript without a student picker', async ({
      page,
    }) => {
      await page.goto('/student/reports');
      await expect(page.getByRole('region', { name: REPORT_TITLES.transcript })).toBeVisible();
      await expect(page.getByRole('region', { name: REPORT_TITLES.institutional })).toHaveCount(0);
      await expect(page.getByRole('region', { name: REPORT_TITLES.analytics })).toHaveCount(0);
      await expect(page.locator('#report-student-search')).toHaveCount(0);
    });

    test('generates a transcript scoped to self with no studentId in the request', async ({
      page,
    }) => {
      const captured: CapturedReportRequest[] = [];
      await mockReportingServerFns(page, captured);
      await page.goto('/student/reports');

      const card = page.getByRole('region', { name: REPORT_TITLES.transcript });
      await card.getByRole('button', { name: 'Generate report' }).click();
      await expect(page.getByText('Report generated successfully.')).toBeVisible();

      const request = captured.find((entry) => entry.kind === 'requestReport');
      expect(request).toBeDefined();
      expect(request!.body).toContain('official_transcript');
      expect(request!.body).not.toContain('studentId');
    });

    test('expired reports are not downloadable', async ({ page }) => {
      const sql = await openDb();
      try {
        await insertJob(sql, {
          requesterEmail: 'student@e2e.test',
          reportType: 'official_transcript',
          state: 'expired',
          artifactKey: null,
        });
      } finally {
        await sql.end();
      }
      await page.goto('/student/reports');

      const item = page.locator('li', { hasText: REPORT_TITLES.transcript }).first();
      await expect(item.getByText('Expired', { exact: true })).toBeVisible();
      await expect(
        page.getByText('This report has expired and can no longer be downloaded.'),
      ).toBeVisible();
      await expect(item.getByRole('button', { name: 'Download' })).toHaveCount(0);
    });
  });
});
