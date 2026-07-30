import { stopGracefully } from './email-queue-init';
import { closeDb } from '@/db/index';
import { logger } from '@/lib/logger';
import { getEnv } from '@/config/env';

let isShuttingDown = false;

/**
 * Register SIGTERM and SIGINT handlers for graceful shutdown.
 * On first signal: stop the email queue interval, drain in-flight tick,
 * close the DB pool, then exit(0). On second signal: immediate exit(1).
 * If drain doesn't complete within SHUTDOWN_TIMEOUT_MS, forces exit(1).
 * No-op when not running in SSR (e.g., during client-side hydration).
 */
export function registerShutdownHandlers(): void {
  if (!import.meta.env.SSR) return;

  const { SHUTDOWN_TIMEOUT_MS } = getEnv();

  const gracefulShutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      logger.warn({ event: 'shutdown.force_exit', signal, reason: 'second_signal' });
      process.exit(1);
      return;
    }

    isShuttingDown = true;
    logger.info({ event: 'shutdown.start', signal });

    const timeoutHandle = setTimeout(() => {
      logger.warn({ event: 'shutdown.timeout', timeoutMs: SHUTDOWN_TIMEOUT_MS });
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      await stopGracefully();
      await closeDb();
      logger.info({ event: 'shutdown.complete' });
      clearTimeout(timeoutHandle);
      process.exit(0);
    } catch (error) {
      logger.error({
        event: 'shutdown.error',
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
