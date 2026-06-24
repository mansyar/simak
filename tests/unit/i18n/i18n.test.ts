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
