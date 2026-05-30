import { Resend } from 'resend';
import { eq } from 'drizzle-orm';
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

function isDueForRetry(lastAttemptAt: Date | null, attempts: number | null): boolean {
  if (!lastAttemptAt) return true;
  const elapsed = Date.now() - lastAttemptAt.getTime();
  const index = Math.min(attempts ?? 0, BACKOFF_MS.length - 1);
  return elapsed >= BACKOFF_MS[index];
}

/**
 * Process up to 10 pending email queue items.
 * For each: checks backoff, sends via Resend, updates status/attempts.
 * After 3 failed attempts, marks the item as `failed`.
 */
export async function processEmailQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const db = getDb();
  const resend = getResendClient();

  let processed = 0;
  let sent = 0;
  let failed = 0;

  const pendingEmails = await db
    .select()
    .from(emailQueue)
    .where(eq(emailQueue.status, 'pending'))
    .orderBy(emailQueue.createdAt)
    .limit(10);

  for (const email of pendingEmails) {
    if (!isDueForRetry(email.lastAttemptAt, email.attempts)) {
      continue;
    }

    processed++;

    try {
      const result = await resend.emails.send({
        from: 'SIMAK <noreply@simak.app>',
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
