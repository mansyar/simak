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
const CHUNK_SIZE = 5;

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
  reclaimed: number;
}> {
  const db = getDb();
  const resend = getResendClient();

  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);
  // Drizzle's UPDATE result type doesn't expose rowCount; cast to read it
  const reclaimResult = (await db
    .update(emailQueue)
    .set({ status: 'pending' })
    .where(
      and(eq(emailQueue.status, 'processing'), lt(emailQueue.lastAttemptAt, staleThreshold)),
    )) as unknown as { rowCount?: number };
  const reclaimed = reclaimResult?.rowCount ?? 0;

  if (reclaimed > 0) {
    console.info({ event: 'email_queue.reclaimed', count: reclaimed });
  }

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

  console.info({ event: 'email_queue.cycle_start', dueCount: emails.length });

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE);

    const results = await Promise.allSettled(
      chunk.map(async (email) => {
        try {
          const fromAddr = getEnv().EMAIL_FROM;
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
              resendMessageId: result.data?.id ?? null,
            })
            .where(eq(emailQueue.id, email.id));

          return 'sent';
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

          console.warn({
            event: 'email_queue.send_failed',
            emailId: email.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            attempts: newAttempts,
            status: shouldFail ? 'failed' : 'pending',
          });

          return shouldFail ? 'failed' : 'pending';
        }
      }),
    );

    for (const result of results) {
      processed++;
      if (result.status === 'fulfilled' && result.value === 'sent') {
        sent++;
      } else {
        failed++;
      }
    }
  }

  console.info({
    event: 'email_queue.cycle_end',
    processed,
    sent,
    failed,
    reclaimed,
  });

  return { processed, sent, failed, reclaimed };
}
