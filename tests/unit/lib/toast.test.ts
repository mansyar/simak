import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';
import { showErrorToast, showSuccessToast, parseServerError } from '@/lib/toast';
import { ErrorCode } from '@/lib/errors';

const t = vi.fn((key: string) => `i18n:${key}`);

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('showErrorToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['UNAUTHORIZED', 'error.unauthorized'],
    ['FORBIDDEN', 'error.forbidden'],
    ['NOT_FOUND', 'error.notFound'],
    ['VALIDATION', 'error.validation'],
    ['CONFLICT', 'error.conflict'],
    ['INTERNAL', 'error.internal'],
  ] as [ErrorCode, string][])('maps %s to the %s i18n key', (code, key) => {
    showErrorToast(code, t);

    expect(t).toHaveBeenCalledWith(key);
    expect(toast.error).toHaveBeenCalledWith(`i18n:${key}`, expect.any(Object));
  });

  it('maps NETWORK to the network i18n key', () => {
    showErrorToast('NETWORK', t);

    expect(t).toHaveBeenCalledWith('error.network');
    expect(toast.error).toHaveBeenCalledWith('i18n:error.network', expect.any(Object));
  });

  it('falls back to error.default for unknown codes', () => {
    showErrorToast('MY_CUSTOM_CODE', t);

    expect(t).toHaveBeenCalledWith('error.default');
    expect(toast.error).toHaveBeenCalledWith('i18n:error.default', expect.any(Object));
  });

  it('passes sensible default toast options', () => {
    showErrorToast('INTERNAL', t);

    expect(toast.error).toHaveBeenCalledWith(expect.any(String), {
      duration: 5000,
      position: 'top-right',
    });
  });
});

describe('showSuccessToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls toast.success with the given message', () => {
    showSuccessToast('Operation succeeded');

    expect(toast.success).toHaveBeenCalledWith('Operation succeeded');
  });

  it('calls toast.success with a single string argument', () => {
    showSuccessToast('Saved');

    expect(toast.success).toHaveBeenCalledWith('Saved');
  });
});

describe('parseServerError', () => {
  it('extracts code and message from the typed ServerError shape', () => {
    const result = parseServerError({
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });

    expect(result).toEqual({
      code: 'NOT_FOUND',
      message: 'User not found',
    });
  });

  it('tolerates legacy { error: string } shape', () => {
    const result = parseServerError({ error: 'Legacy error message' });

    expect(result).toEqual({
      code: 'INTERNAL',
      message: 'Legacy error message',
    });
  });

  it('returns UNKNOWN/default when the response is not an object', () => {
    expect(parseServerError(null)).toEqual({
      code: 'UNKNOWN',
      message: '',
    });
    expect(parseServerError(undefined)).toEqual({
      code: 'UNKNOWN',
      message: '',
    });
    expect(parseServerError('raw string')).toEqual({
      code: 'UNKNOWN',
      message: '',
    });
  });

  it('returns UNKNOWN/default when the response lacks a valid error property', () => {
    expect(parseServerError({})).toEqual({
      code: 'UNKNOWN',
      message: '',
    });
    expect(parseServerError({ error: { foo: 'bar' } })).toEqual({
      code: 'UNKNOWN',
      message: '',
    });
  });
});
