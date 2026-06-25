import { toast } from 'sonner';
import { ErrorCode } from './errors';
import type { TranslationKey } from '../i18n/index';

export type TFunction = (key: TranslationKey, params?: Record<string, string>) => string;

const VALID_ERROR_CODES: readonly ErrorCode[] = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'CONFLICT',
  'INTERNAL',
];

const ERROR_CODE_TO_KEY: Record<ErrorCode | 'NETWORK', TranslationKey> = {
  UNAUTHORIZED: 'error.unauthorized',
  FORBIDDEN: 'error.forbidden',
  NOT_FOUND: 'error.notFound',
  VALIDATION: 'error.validation',
  CONFLICT: 'error.conflict',
  INTERNAL: 'error.internal',
  NETWORK: 'error.network',
};

export function showErrorToast(code: string, t: TFunction): void {
  const key = (ERROR_CODE_TO_KEY as Record<string, TranslationKey>)[code] ?? 'error.default';
  const message = t(key);

  toast.error(message, {
    duration: 5000,
    position: 'top-right',
  });
}

export function parseServerError(response: unknown): {
  code: ErrorCode | 'UNKNOWN';
  message: string;
} {
  if (response === null || typeof response !== 'object') {
    return { code: 'UNKNOWN', message: '' };
  }

  const res = response as Record<string, unknown>;

  if (typeof res.error === 'string') {
    return { code: 'INTERNAL', message: res.error };
  }

  if (typeof res.error !== 'object' || res.error === null) {
    return { code: 'UNKNOWN', message: '' };
  }

  const errorObject = res.error as Record<string, unknown>;

  if (typeof errorObject.code !== 'string' || typeof errorObject.message !== 'string') {
    return { code: 'UNKNOWN', message: '' };
  }

  const code = VALID_ERROR_CODES.includes(errorObject.code as ErrorCode)
    ? (errorObject.code as ErrorCode)
    : 'UNKNOWN';

  return {
    code,
    message: errorObject.message,
  };
}
