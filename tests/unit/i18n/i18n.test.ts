import { describe, it, expect } from 'vitest';
import en from '../../../locales/en.json';
import id from '../../../locales/id.json';

describe('Rate-limit i18n keys', () => {
  it('should include auth.rateLimit in English translations', () => {
    expect(en.auth?.rateLimit).toBeDefined();
  });

  it('should include auth.rateLimit in Indonesian translations', () => {
    expect(id.auth?.rateLimit).toBeDefined();
  });
});

describe('UI fallback i18n parity', () => {
  const keys = [
    ['common', 'unknownUser'],
    ['settings', 'sessions', 'unknownIp'],
    ['settings', 'sessions', 'unknownDevice'],
    ['settings', 'sessions', 'deviceOn'],
    ['instructorAnalytics', 'notAvailable'],
    ['instructorAnalytics', 'responseHours'],
    ['extensions', 'reasonCharacterCount'],
    ['extensions', 'durationMaxHint'],
  ] as const;

  const read = (source: unknown, path: readonly string[]) =>
    path.reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      source,
    );

  it('keeps fallback and technical-value keys in both locales', () => {
    for (const key of keys) {
      expect(read(en, key)).toBeTypeOf('string');
      expect(read(id, key)).toBeTypeOf('string');
    }
  });
});
