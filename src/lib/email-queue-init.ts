import { processEmailQueue } from './email-queue-processor';

const POLL_INTERVAL_MS = 30_000;
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background email queue processor.
 * Runs immediately on first call, then every 30 seconds.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startEmailQueue(): void {
  if (intervalId !== null) return;

  processEmailQueue().catch(console.error);

  intervalId = setInterval(() => {
    processEmailQueue().catch(console.error);
  }, POLL_INTERVAL_MS);
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
