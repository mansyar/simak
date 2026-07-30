import { processEmailQueue, reclaimAllProcessingRows } from './email-queue-processor';
import { pruneOldEmails } from './email-queue-retention';
import { processDeadlineReminders } from './deadline-reminder-scanner';
import { processOrphanedR2Objects } from './r2-cleanup';
import { logger } from '@/lib/logger';

const POLL_INTERVAL_MS = 30_000;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMINDER_SCAN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const R2_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastPruneAt: Date | null = null;
let lastReminderScanAt: Date | null = null;
let lastR2CleanupAt: Date | null = null;
let currentTickPromise: Promise<void> | null = null;

async function tick(): Promise<void> {
  if (isRunning) return;

  isRunning = true;
  const tickLogger = logger.child({ requestId: crypto.randomUUID() });
  try {
    await processEmailQueue();

    const now = Date.now();

    // Deadline reminder scanner — hourly throttle, advisory (failure must not break email processing)
    if (
      lastReminderScanAt === null ||
      now - lastReminderScanAt.getTime() > REMINDER_SCAN_INTERVAL_MS
    ) {
      try {
        await processDeadlineReminders();
        lastReminderScanAt = new Date();
      } catch (error) {
        tickLogger.error({
          event: 'deadline_reminder.scan_error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // R2 orphaned object cleanup — 6h throttle, advisory (failure must not break email processing)
    if (lastR2CleanupAt === null || now - lastR2CleanupAt.getTime() > R2_CLEANUP_INTERVAL_MS) {
      try {
        await processOrphanedR2Objects();
        lastR2CleanupAt = new Date();
      } catch (error) {
        tickLogger.error({
          event: 'r2_cleanup_scanner_failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (lastPruneAt === null || now - lastPruneAt.getTime() > PRUNE_INTERVAL_MS) {
      const result = await pruneOldEmails();
      lastPruneAt = new Date();
      tickLogger.info({ event: 'email_queue.retention_pruned', deleted: result.deleted });
    }
  } catch (error) {
    tickLogger.error({
      event: 'email_queue.tick_error',
      error: error instanceof Error ? error.message : String(error),
      willRetryNextInterval: true,
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Start the background email queue processor.
 * Runs immediately on first call, then every 30 seconds.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startEmailQueue(): void {
  if (intervalId !== null) return;

  reclaimAllProcessingRows().then(() => {
    currentTickPromise = tick();
    intervalId = setInterval(() => {
      if (!isRunning) currentTickPromise = tick();
    }, POLL_INTERVAL_MS);
  });
}

/**
 * Stop the background email queue processor and drain any in-flight tick.
 */
export async function stopGracefully(): Promise<void> {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (currentTickPromise) {
    await currentTickPromise;
  }
}
