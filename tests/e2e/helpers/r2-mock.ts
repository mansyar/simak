import type { Page } from '@playwright/test';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../../src/db/index';
import { submissions, checkpoints, users } from '../../../src/db/schema/index';

/**
 * R2 mock helpers for E2E tests.
 *
 * Since R2 is not configured in the E2E environment, server-side R2 calls
 * (getObjectContentLength, generatePresignedUploadUrl) fail. We mock the
 * server function HTTP calls via page.route() and also insert real DB
 * records so listSubmissions and other DB queries return real data.
 */

const MOCK_UPLOAD_URL = 'http://localhost:9999/upload';
const MOCK_DOWNLOAD_URL = 'http://localhost:9999/download';
export const MOCK_FILE_KEY = 'e2e-test-file-key';
export const MOCK_FILE_SIZE = 1024;

/**
 * Set up R2 mocks for a page.
 *
 * Intercepts:
 * 1. getPresignedUploadUrl server fn → returns mock { uploadUrl, fileKey }
 * 2. PUT to mock upload URL → returns 200
 * 3. submitCheckpoint server fn → inserts real DB records + returns { success: true }
 * 4. getPresignedDownloadUrl server fn → returns mock { downloadUrl }
 * 5. GET to mock download URL → returns mock file content
 *
 * @param page - The Playwright page to set up mocks on
 * @param studentEmail - Email of the student user (to get userId for DB inserts)
 */
export async function setupR2Mocks(
  page: Page,
  studentEmail: string = 'student@e2e.test',
): Promise<void> {
  // Query the DB once to get the student's user ID
  let studentUserId: string | null = null;
  try {
    const db = getDb();
    const [studentUser] = await db.select().from(users).where(eq(users.email, studentEmail));
    studentUserId = studentUser?.id ?? null;
  } catch (err) {
    console.error('R2 mock: Failed to get student user ID:', err);
  }

  // 1. Intercept server function calls
  await page.route('**/_serverFn/**', async (route) => {
    const request = route.request();
    const url = request.url();

    // GET requests: getPresignedUploadUrl or getPresignedDownloadUrl
    if (request.method() === 'GET') {
      // getPresignedUploadUrl: payload contains 'contentType' (unique identifier)
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

      // getPresignedDownloadUrl: payload contains 'submissionId' (no other GET server fn uses this in the UI)
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

    // POST requests: submitCheckpoint
    if (request.method() === 'POST') {
      const postData = request.postData();
      // submitCheckpoint: body contains 'fileKey' (unique identifier)
      if (postData && postData.includes('fileKey')) {
        await handleMockSubmitCheckpoint(route, postData, studentUserId);
        return;
      }
    }

    // All other requests: continue to real server
    await route.continue();
  });

  // 2. Intercept PUT to mock upload URL (browser → mock R2)
  await page.route(`${MOCK_UPLOAD_URL}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: 'OK',
    });
  });

  // 3. Intercept GET to mock download URL (browser → mock R2)
  await page.route(`${MOCK_DOWNLOAD_URL}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: 'Mock PDF content',
    });
  });
}

/**
 * Handle mock submitCheckpoint: insert real DB records and return success.
 *
 * Parses the POST body to extract checkpointId and fileName, then:
 * 1. Calculates the next version number
 * 2. Inserts a submission record into the DB
 * 3. Updates the checkpoint state to 'submitted'
 * 4. Returns { success: true }
 */
async function handleMockSubmitCheckpoint(
  route: import('@playwright/test').Route,
  postData: string,
  studentUserId: string | null,
): Promise<void> {
  // Parse the POST body to extract checkpointId and fileName
  let checkpointId: number | undefined;
  let fileName: string | undefined;

  try {
    const parsed = JSON.parse(postData);
    const data = parsed.data || parsed;
    checkpointId = data.checkpointId;
    fileName = data.fileName;
  } catch {
    // If JSON parsing fails, try regex extraction
    const cpMatch = postData.match(/"checkpointId"\s*:\s*(\d+)/);
    checkpointId = cpMatch ? Number(cpMatch[1]) : undefined;
    const nameMatch = postData.match(/"fileName"\s*:\s*"([^"]+)"/);
    fileName = nameMatch ? nameMatch[1] : undefined;
  }

  // Insert real DB records if we have the required information
  if (checkpointId && studentUserId) {
    try {
      const db = getDb();

      // Get the next version number
      const [versionResult] = await db
        .select({ maxVersion: sql<number>`COALESCE(MAX(${submissions.version}), 0)::int` })
        .from(submissions)
        .where(eq(submissions.checkpointId, checkpointId));
      const nextVersion = Number(versionResult?.maxVersion ?? 0) + 1;

      // Insert submission record
      await db.insert(submissions).values({
        checkpointId,
        uploadedBy: studentUserId,
        fileKey: MOCK_FILE_KEY,
        fileName: fileName || 'test.pdf',
        fileSize: MOCK_FILE_SIZE,
        version: nextVersion,
      });

      // Update checkpoint state to 'submitted'
      await db
        .update(checkpoints)
        .set({ state: 'submitted', updatedAt: new Date() })
        .where(eq(checkpoints.id, checkpointId));
    } catch (err) {
      console.error('R2 mock: Failed to insert DB records:', err);
    }
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true }),
  });
}
