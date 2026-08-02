export const DEFAULT_TIME_ZONE = 'UTC';

/**
 * Returns whether a value is a timezone supported by the current Intl runtime.
 * This intentionally uses the runtime rather than a browser-only timezone list
 * so the same validation is safe in server-rendered code.
 */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(savedTimeZone?: unknown, detectedTimeZone?: unknown): string {
  if (isValidTimeZone(savedTimeZone)) return savedTimeZone;
  if (isValidTimeZone(detectedTimeZone)) return detectedTimeZone;
  return DEFAULT_TIME_ZONE;
}
