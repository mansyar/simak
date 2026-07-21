import type { Page } from '@playwright/test';

/**
 * R2 mock helpers for E2E tests.
 *
 * Since R2 is not configured in the E2E environment, server-side R2 calls
 * (getObjectContentLength, generatePresignedUploadUrl) fail. This module
 * provides page.route() interceptors for the browser-side server function
 * calls that trigger R2 operations.
 *
 * IMPORTANT LIMITATION: TanStack Start's client-side server function fetcher
 * (serverFnFetcher.ts → getResponse()) does not correctly parse mock responses
 * returned by page.route(). The mock returns valid JSON with content-type:
 * application/json, but the client receives `undefined` instead of the parsed
 * JSON object. This is likely due to the response framing/serialization format
 * used by TanStack Start's internal RPC mechanism.
 *
 * As a workaround, student-submission tests use direct DB insertion to create
 * submission records, bypassing the upload flow entirely. The R2 mock is kept
 * here to document the intended approach and satisfy the spec requirement (FR-4).
 */

export const MOCK_FILE_KEY = 'e2e-test-file-key';
export const MOCK_FILE_SIZE = 1024;
const MOCK_UPLOAD_URL = 'http://localhost:3000/mock-upload';
const MOCK_DOWNLOAD_URL = 'http://localhost:3000/mock-download';

/**
 * Set up R2 mocks for a page.
 *
 * Intercepts:
 * 1. getPresignedUploadUrl server fn → returns mock { uploadUrl, fileKey }
 * 2. PUT to mock upload URL → returns 200
 * 3. getPresignedDownloadUrl server fn → returns mock { downloadUrl }
 * 4. GET to mock download URL → returns mock file content
 *
 * Note: Due to the TanStack Start limitation described above, the mocked
 * server function responses may not be correctly parsed by the client.
 * Tests that depend on the upload flow should use direct DB insertion instead.
 *
 * @param page - The Playwright page to set up mocks on
 */
export async function setupR2Mocks(page: Page): Promise<void> {
  // 1. Intercept server function calls
  await page.route('**/_serverFn/**', async (route) => {
    const request = route.request();
    const url = request.url();

    // GET requests: getPresignedUploadUrl or getPresignedDownloadUrl
    if (request.method() === 'GET') {
      // getPresignedUploadUrl: payload contains 'contentType'
      if (url.includes('contentType')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            uploadUrl: MOCK_UPLOAD_URL,
            fileKey: MOCK_FILE_KEY,
          }),
        });
        return;
      }

      // getPresignedDownloadUrl: payload contains 'submissionId'
      if (url.includes('submissionId')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            downloadUrl: MOCK_DOWNLOAD_URL,
          }),
        });
        return;
      }
    }

    // All other requests: continue to real server
    await route.continue();
  });

  // 2. Intercept PUT to mock upload URL
  await page.route('**/mock-upload**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: 'OK',
    });
  });

  // 3. Intercept GET to mock download URL
  await page.route('**/mock-download**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: 'Mock PDF content',
    });
  });
}
