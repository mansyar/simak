import pino, { type Logger as PinoLogger } from 'pino';
import { createRequire } from 'node:module';
import { getEnv } from '@/config/env';
import { requestContextStorage } from '@/lib/request-context-store';

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
  const mixin = () => {
    const store = requestContextStorage.getStore();
    return store ? { requestId: store.requestId } : {};
  };

  if (import.meta.env?.PROD ?? process.env.NODE_ENV === 'production') {
    return pino({ level, mixin }, stream);
  }

  // Dev mode: pretty print via pino-pretty (loaded lazily to avoid bundling in production)
  const req = createRequire(import.meta.url);
  const pretty = req('pino-pretty');
  const prettyStream = pretty({ colorize: true, destination: stream });
  return pino({ level, mixin }, prettyStream);
}

export const logger: Logger = createLogger();
