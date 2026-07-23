import { processEmailQueue } from './email-queue-processor';
import { pruneOldEmails } from './email-queue-retention';
import { processDeadlineReminders } from './deadline-reminder-scanner';

const POLL_INTERVAL_MS = 30_000;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMINDER_SCAN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastPruneAt: Date | null = null;
let lastReminderScanAt: Date | null = null;

async function tick(): Promise<void> {
  if (isRunning) return;

  isRunning = true;
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
        console.error({
          event: 'deadline_reminder.scan_error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (lastPruneAt === null || now - lastPruneAt.getTime() > PRUNE_INTERVAL_MS) {
      const result = await pruneOldEmails();
      lastPruneAt = new Date();
      console.info({ event: 'email_queue.retention_pruned', deleted: result.deleted });
    }
  } catch (error) {
    console.error({
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

  tick();

  intervalId = setInterval(tick, POLL_INTERVAL_MS);
}

/**
 * Stop the background email queue processor.
 */
export function stopEmailQueue(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
