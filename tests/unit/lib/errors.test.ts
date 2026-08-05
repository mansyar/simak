/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ErrorCode,
  serverError,
  logError,
  isServerError,
  getErrorTranslationKey,
  type ServerError,
  type ErrorContext,
} from '@/lib/errors';

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';

describe('ErrorCode', () => {
  it('includes the required error codes', () => {
    const codes: ErrorCode[] = [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION',
      'CONFLICT',
      'INTERNAL',
    ];
    expect(codes).toHaveLength(6);
    codes.forEach((code) => expect(typeof code).toBe('string'));
  });

  it('includes RATE_LIMITED', () => {
    expect(ErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
  });

  it('maps server error codes to localized UI message keys', () => {
    expect(getErrorTranslationKey(ErrorCode.FORBIDDEN)).toBe('error.forbidden');
    expect(getErrorTranslationKey(ErrorCode.NOT_FOUND)).toBe('error.notFound');
    expect(getErrorTranslationKey(ErrorCode.INTERNAL)).toBe('error.internal');
  });
});

describe('serverError', () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
  });

  it('returns a typed ServerError shape with code and message', () => {
    const result: ServerError = serverError('NOT_FOUND', 'User not found');

    expect(result).toEqual({
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
  });

  it('never exposes stack traces or internal context in the response', () => {
    const cause = new Error('DB connection failed');
    const result = serverError('INTERNAL', 'Internal server error', {
      cause,
      handler: 'testHandler',
    });

    expect(result).toEqual({
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
    expect(result.error).not.toHaveProperty('stack');
    expect(result.error).not.toHaveProperty('cause');
  });

  it('calls logError with the supplied context', async () => {
    const context: ErrorContext = {
      userId: 'user-123',
      handler: 'createUser',
      input: { email: 'a@example.com' },
    };

    serverError('VALIDATION', 'Invalid input', context);

    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledTimes(1));
    const entry = vi.mocked(logger.error).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry.code).toBe('VALIDATION');
    expect(entry.message).toBe('Invalid input');
    expect(entry.userId).toBe('user-123');
    expect(entry.handler).toBe('createUser');
  });

  it('returns a RATE_LIMITED ServerError', () => {
    const result = serverError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded');

    expect(result).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' },
    });
  });
});

describe('isServerError', () => {
  it('returns true for a RATE_LIMITED server error', () => {
    const result = serverError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded');

    expect(isServerError(result)).toBe(true);
  });
});

describe('logError', () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
  });

  it('calls logger.error with an entry object containing timestamp, code, and message', async () => {
    logError('NOT_FOUND', 'Resource missing');

    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledTimes(1));
    const entry = vi.mocked(logger.error).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry.code).toBe('NOT_FOUND');
    expect(entry.message).toBe('Resource missing');
    expect(typeof entry.timestamp).toBe('string');
  });

  it('includes optional fields cause, userId, handler, stack, and input when provided', async () => {
    const cause = new Error('Connection reset');
    logError('INTERNAL', 'Unexpected error', {
      cause,
      userId: 'user-2',
      handler: 'saveThing',
      input: { name: 'x' },
    });

    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledTimes(1));
    const entry = vi.mocked(logger.error).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry.cause).toBe('Connection reset');
    expect(entry.userId).toBe('user-2');
    expect(entry.handler).toBe('saveThing');
    expect(entry.input).toEqual({ name: 'x' });
    expect(entry.stack).toBeDefined();
    expect(typeof entry.stack).toBe('string');
  });

  it('includes the stack trace when an Error is provided as cause', async () => {
    const cause = new Error('Connection reset');
    logError('INTERNAL', 'Unexpected error', { cause, handler: 'testHandler' });

    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledTimes(1));
    const entry = vi.mocked(logger.error).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry.stack).toContain('Connection reset');
  });

  it('redacts sensitive fields from the input summary', async () => {
    logError('VALIDATION', 'Bad input', {
      input: {
        email: 'a@example.com',
        password: 'secret123',
        token: 'abc',
        secret: 'shh',
      },
    });

    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledTimes(1));
    const entry = vi.mocked(logger.error).mock.calls[0]?.[0] as Record<string, unknown>;
    const input = entry.input as Record<string, string>;
    expect(input.password).toBe('[REDACTED]');
    expect(input.token).toBe('[REDACTED]');
    expect(input.secret).toBe('[REDACTED]');
    expect(input.email).toBe('a@example.com');
  });

  it('omits optional fields when not provided', async () => {
    logError('NOT_FOUND', 'Resource missing');

    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledTimes(1));
    const entry = vi.mocked(logger.error).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry).not.toHaveProperty('cause');
    expect(entry).not.toHaveProperty('userId');
    expect(entry).not.toHaveProperty('handler');
    expect(entry).not.toHaveProperty('stack');
    expect(entry).not.toHaveProperty('input');
  });
});
