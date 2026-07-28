import pino, { type Logger as PinoLogger } from 'pino';
import { createRequire } from 'node:module';
import { getEnv } from '@/config/env';

export type Logger = PinoLogger;

interface CreateLoggerOptions {
  level?: string;
  stream?: NodeJS.WritableStream;
}

/**
 * Creates a pino logger instance.
 * - Production: JSON output to the given stream (default: stdout)
 * - Development: pretty-printed output via pino-pretty (loaded lazily)
 */
export function createLogger(options?: CreateLoggerOptions): Logger {
  const level = options?.level ?? getEnv().LOG_LEVEL;
  const stream = options?.stream ?? process.stdout;

  if (import.meta.env.PROD) {
    return pino({ level }, stream);
  }

  // Dev mode: pretty print via pino-pretty (loaded lazily to avoid bundling in production)
  const req = createRequire(import.meta.url);
  const pretty = req('pino-pretty');
  const prettyStream = pretty({ colorize: true, destination: stream });
  return pino({ level }, prettyStream);
}

export const logger: Logger = createLogger();

/**
 * Logs an advisory failure (non-critical error in post-commit catch blocks).
 * Used by server handlers to replace ad-hoc `console.error('Failed to...', err)` calls.
 */
export function logAdvisoryFailure(handler: string, error: unknown): void {
  logger.error({
    event: 'advisory_failed',
    handler,
    error: error instanceof Error ? error.message : String(error),
  });
}
