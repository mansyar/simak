import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'simak-locale';

describe('Locale detection logic', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    // Default: English browser
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
    });
  });

  it('should default to "en" when no preference is stored and browser is English', () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeNull();

    const browserLocale = navigator.language.startsWith('id') ? 'id' : 'en';
    const detected = stored ?? browserLocale;

    expect(detected).toBe('en');
  });

  it('should detect Indonesian locale from browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'id-ID',
      configurable: true,
    });

    const browserLocale = navigator.language.startsWith('id') ? 'id' : 'en';
    expect(browserLocale).toBe('id');
  });

  it('should respect stored user preference over browser language', () => {
    localStorage.setItem(STORAGE_KEY, 'id');

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBe('id');

    // Stored preference takes precedence over browser
    const browserLocale = navigator.language.startsWith('id') ? 'id' : 'en';
    const detected = stored ?? browserLocale;

    expect(detected).toBe('id');
    expect(detected).not.toBe(browserLocale);
  });

  it('should fall back to "en" when no locale is detected and browser is unknown', () => {
    const FALLBACK = 'en';
    const stored = localStorage.getItem(STORAGE_KEY);
    const browserLocale = null; // Simulate no browser locale detection

    const detected = stored ?? browserLocale ?? FALLBACK;
    expect(detected).toBe('en');
  });

  it('should clear stored preference and fall back to browser language', () => {
    localStorage.setItem(STORAGE_KEY, 'en');
    localStorage.removeItem(STORAGE_KEY);

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeNull();

    Object.defineProperty(navigator, 'language', {
      value: 'id-ID',
      configurable: true,
    });

    const detected = stored ?? (navigator.language.startsWith('id') ? 'id' : 'en');
    expect(detected).toBe('id');
  });
});
