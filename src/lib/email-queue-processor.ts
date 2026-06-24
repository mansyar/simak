import { Resend } from 'resend';
import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { getEnv } from '@/config/env';
import { emailQueue } from '@/db/schema/index';

// --- Shared Resend client (lazy singleton) ---

let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!_resend) {
    _resend = new Resend(getEnv().RESEND_API_KEY);
  }
  return _resend;
}

// --- Backoff intervals (in ms) ---
// Index maps to number of previous attempts: 0 → no delay, 1 → 30s, 2 → 5min, 3+ → 30min
const BACKOFF_MS = [0, 30_000, 300_000, 1_800_000];

// --- Claim / reclaim settings ---
const CLAIM_LIMIT = 10;
const STALE_PROCESSING_THRESHOLD_MS = 5 * 60 * 1000;

function isDueForRetry(lastAttemptAt: Date | null, attempts: number | null): boolean {
  if (!lastAttemptAt) return true;
  const elapsed = Date.now() - lastAttemptAt.getTime();
  const index = Math.min(attempts ?? 0, BACKOFF_MS.length - 1);
  return elapsed >= BACKOFF_MS[index];
}

/**
 * Process up to 10 pending email queue items.
 *
 * 1. Reclaims stale `processing` rows (> 5 min) back to `pending`.
 * 2. Claims up to 10 due `pending` rows inside a transaction using
 *    `SELECT ... FOR UPDATE SKIP LOCKED`, marking them `processing`.
 * 3. Sends each email via Resend OUTSIDE the transaction.
 * 4. Updates each row individually to `sent`, `pending` (with incremented
 *    attempts), or `failed` after 3 attempts.
 */
export async function processEmailQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const db = getDb();
  const resend = getResendClient();

  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);
  await db
    .update(emailQueue)
    .set({ status: 'pending' })
    .where(and(eq(emailQueue.status, 'processing'), lt(emailQueue.lastAttemptAt, staleThreshold)));

  const emails = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(emailQueue)
      .where(eq(emailQueue.status, 'pending'))
      .orderBy(emailQueue.createdAt)
      .limit(CLAIM_LIMIT)
      .for('update', { skipLocked: true });

    const dueRows = rows.filter((row) => isDueForRetry(row.lastAttemptAt, row.attempts));

    if (dueRows.length > 0) {
      const now = new Date();
      await Promise.all(
        dueRows.map((row) =>
          tx
            .update(emailQueue)
            .set({ status: 'processing', lastAttemptAt: now })
            .where(eq(emailQueue.id, row.id)),
        ),
      );
    }

    return dueRows;
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    processed++;

    try {
      const fromAddr = process.env.EMAIL_FROM || 'SIMAK <noreply@simak.app>';
      const result = await resend.emails.send({
        from: fromAddr,
        to: email.recipientEmail,
        subject: email.subject,
        html: email.bodyHtml,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      await db
        .update(emailQueue)
        .set({
          status: 'sent',
          lastAttemptAt: new Date(),
          errorMessage: null,
        })
        .where(eq(emailQueue.id, email.id));

      sent++;
    } catch (error) {
      const newAttempts = (email.attempts ?? 0) + 1;
      const shouldFail = newAttempts >= 3;

      await db
        .update(emailQueue)
        .set({
          attempts: newAttempts,
          status: shouldFail ? 'failed' : 'pending',
          lastAttemptAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(emailQueue.id, email.id));

      failed++;
    }
  }

  return { processed, sent, failed };
}
