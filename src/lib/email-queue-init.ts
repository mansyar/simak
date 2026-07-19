import { processEmailQueue } from './email-queue-processor';

const POLL_INTERVAL_MS = 30_000;
let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function tick(): Promise<void> {
  if (isRunning) return;

  isRunning = true;
  try {
    await processEmailQueue();
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
