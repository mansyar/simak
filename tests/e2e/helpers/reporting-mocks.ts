import type { Page } from '@playwright/test';

/**
 * Reporting server-function mocks for E2E tests.
 *
 * The reporting UI calls real server functions for catalog, history, and
 * status (no R2 needed). Only the two R2-backed actions are intercepted at
 * the UI-to-server boundary:
 *   - `requestReport`  → completes the job immediately so the UI reaches its
 *     success state without a real provider or a production test bypass.
 *   - `downloadReport` → returns a short-lived mock URL that carries no
 *     artifact key.
 *
 * Dispatch is by the compiler-generated serverFn id embedded in the
 * `/_serverFn/<base64-id>` URL (e.g. `downloadReport_createServerFn_handler`).
 * This avoids parsing the seroval-framed request body. Mock responses are
 * sent as plain JSON WITHOUT the `x-tss-serialized` header, which the
 * TanStack Start client's `serverFnFetcher` returns as-is.
 */
export const MOCK_DOWNLOAD_BASE_URL = 'http://localhost:3000/mock-report-download';

export type CapturedReportRequest = {
  kind: 'requestReport' | 'downloadReport';
  url: string;
  body: string;
};

const REQUEST_REPORT_EXPORT = 'requestReport_createServerFn_handler';
const DOWNLOAD_REPORT_EXPORT = 'downloadReport_createServerFn_handler';

type MockReportJob = {
  id: number;
  reportType: string;
  locale: string;
  state: string;
  createdAt: string;
  completedAt: string;
  expiresAt: string;
};

function completedJobMock(reportType: string, locale: string): MockReportJob {
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: 1,
    reportType,
    locale,
    state: 'completed',
    createdAt: now,
    completedAt: now,
    expiresAt: expires,
  };
}

/** Extract the serverFn export name from a `/_serverFn/<base64-id>` URL. */
function serverFnExportName(url: string): string | null {
  const match = url.match(/\/_serverFn\/([^?]+)/);
  if (!match) return null;
  try {
    const meta = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    return typeof meta.export === 'string' ? meta.export : null;
  } catch {
    return null;
  }
}

/**
 * Intercept reporting server-function requests and fulfill the R2-backed ones
 * with narrow mocks. All other requests pass through to the real server.
 */
export async function mockReportingServerFns(
  page: Page,
  capture: CapturedReportRequest[] = [],
): Promise<void> {
  await page.route('**/_serverFn/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const exportName = serverFnExportName(url);

    if (exportName === REQUEST_REPORT_EXPORT) {
      capture.push({ kind: 'requestReport', url, body: request.postData() ?? '' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: { job: completedJobMock('official_transcript', 'en') },
        }),
      });
      return;
    }

    if (exportName === DOWNLOAD_REPORT_EXPORT) {
      capture.push({ kind: 'downloadReport', url, body: request.postData() ?? '' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            downloadUrl: `${MOCK_DOWNLOAD_BASE_URL}?expires=300`,
          },
        }),
      });
      return;
    }

    await route.continue();
  });
}

/**
 * Fulfill requests to the mock download URL so the popup opened by the UI
 * loads deterministically. Registered on the context so popups inherit it.
 * Served as HTML (not PDF) so the popup performs a normal navigation; the
 * tests only assert the server-issued URL, never artifact bytes.
 */
export function installMockDownloadRoute(page: Page): void {
  void page.context().route('**/mock-report-download**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body>mock report</body></html>',
    });
  });
}
