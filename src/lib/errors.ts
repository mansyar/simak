import { logger } from '@/lib/logger';

export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ServerError = {
  error: {
    code: ErrorCode;
    message: string;
  };
};

export function isServerError(result: unknown): result is ServerError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as ServerError).error === 'object' &&
    typeof (result as ServerError).error.message === 'string'
  );
}

export type ErrorContext = {
  cause?: unknown;
  userId?: string | null;
  handler?: string;
  input?: unknown;
};

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'refreshToken',
  'accessToken',
  'oldPassword',
  'newPassword',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lower.includes(sensitive.toLowerCase()));
}

const MAX_SANITIZE_DEPTH = 4;

export function sanitizeInput(input: unknown, depth = MAX_SANITIZE_DEPTH): unknown {
  if (depth <= 0) return '[MAX_DEPTH]';
  if (input === null || typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item, depth - 1));
  }

  const record = input as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeInput(value, depth - 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function logError(code: ErrorCode, message: string, context: ErrorContext = {}): void {
  const { cause, userId, handler, input } = context;
  const timestamp = new Date().toISOString();
  const sanitizedInput = sanitizeInput(input);
  const stack = cause instanceof Error ? cause.stack : undefined;
  const causeDetail = cause instanceof Error ? cause.message : cause;

  const entry: Record<string, unknown> = {
    timestamp,
    code,
    message,
  };

  if (causeDetail !== undefined && causeDetail !== '') {
    entry.cause = causeDetail;
  }

  if (userId !== undefined && userId !== null) {
    entry.userId = userId;
  }

  if (handler !== undefined && handler !== '') {
    entry.handler = handler;
  }

  if (stack !== undefined) {
    entry.stack = stack;
  }

  if (sanitizedInput !== undefined) {
    entry.input = sanitizedInput;
  }

  logger.error(entry);
}

export function serverError(
  code: ErrorCode,
  message: string,
  context: ErrorContext = {},
): ServerError {
  logError(code, message, context);
  return { error: { code, message } };
}
