/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorCode,
  serverError,
  logError,
  type ServerError,
  type ErrorContext,
} from '@/lib/errors';

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
});

describe('serverError', () => {
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

  it('calls logError with the supplied context', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const context: ErrorContext = {
      userId: 'user-123',
      handler: 'createUser',
      input: { email: 'a@example.com' },
    };

    serverError('VALIDATION', 'Invalid input', context);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('VALIDATION');
    expect(output).toContain('Invalid input');
    expect(output).toContain('user-123');
    expect(output).toContain('createUser');

    consoleSpy.mockRestore();
  });
});

describe('logError', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  const originalProd = import.meta.env.PROD;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    import.meta.env.PROD = originalProd;
  });

  it('writes a readable multi-line log entry in development', () => {
    import.meta.env.PROD = false;

    logError('NOT_FOUND', 'Resource missing', {
      userId: 'user-1',
      handler: 'getResource',
      input: { id: 1 },
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('[NOT_FOUND]');
    expect(output).toContain('Resource missing');
    expect(output).toContain('user-1');
    expect(output).toContain('getResource');
    expect(output).toContain('id');
  });

  it('writes a single-line JSON log entry in production', () => {
    import.meta.env.PROD = true;

    logError('INTERNAL', 'Database failure', {
      userId: 'user-2',
      handler: 'saveThing',
      input: { name: 'x' },
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.code).toBe('INTERNAL');
    expect(parsed.message).toBe('Database failure');
    expect(parsed.userId).toBe('user-2');
    expect(parsed.handler).toBe('saveThing');
    expect(parsed.input).toEqual({ name: 'x' });
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('includes the stack trace when an Error is provided as cause', () => {
    import.meta.env.PROD = true;
    const cause = new Error('Connection reset');

    logError('INTERNAL', 'Unexpected error', { cause, handler: 'testHandler' });

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.stack).toContain('Connection reset');
  });

  it('redacts sensitive fields from the input summary', () => {
    import.meta.env.PROD = true;

    logError('VALIDATION', 'Bad input', {
      input: {
        email: 'a@example.com',
        password: 'secret123',
        token: 'abc',
        secret: 'shh',
      },
    });

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.input.password).toBe('[REDACTED]');
    expect(parsed.input.token).toBe('[REDACTED]');
    expect(parsed.input.secret).toBe('[REDACTED]');
    expect(parsed.input.email).toBe('a@example.com');
  });
});
