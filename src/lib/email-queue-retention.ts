import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { emailQueue } from '@/db/schema/index';

const SENT_RETENTION_DAYS = 90;
const FAILED_RETENTION_DAYS = 180;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Prune old email queue rows based on retention policy.
 *
 * - `sent` rows older than 90 days are deleted.
 * - `failed` rows older than 180 days are deleted.
 * - `pending` and `processing` rows are never touched.
 *
 * @returns The total number of rows deleted.
 */
export async function pruneOldEmails(): Promise<{ deleted: number }> {
  const db = getDb();
  const now = new Date();

  const sentThreshold = new Date(now.getTime() - SENT_RETENTION_DAYS * MS_PER_DAY);
  const failedThreshold = new Date(now.getTime() - FAILED_RETENTION_DAYS * MS_PER_DAY);

  const sentResult = (await db
    .delete(emailQueue)
    .where(
      and(eq(emailQueue.status, 'sent'), lt(emailQueue.createdAt, sentThreshold)),
    )) as unknown as {
    rowCount?: number;
  };

  const failedResult = (await db
    .delete(emailQueue)
    .where(
      and(eq(emailQueue.status, 'failed'), lt(emailQueue.createdAt, failedThreshold)),
    )) as unknown as { rowCount?: number };

  const deleted = (sentResult?.rowCount ?? 0) + (failedResult?.rowCount ?? 0);

  return { deleted };
}
