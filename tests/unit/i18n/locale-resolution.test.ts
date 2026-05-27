import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i18n/index.ts', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return en fallback when no locale is stored or detected', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    const { detectLocale } = await import('@/i18n/index');
    expect(detectLocale()).toBe('en');
  });

  it('should return id when browser locale starts with id', async () => {
    vi.stubGlobal('navigator', { language: 'id-ID' });
    const { detectLocale } = await import('@/i18n/index');
    expect(detectLocale()).toBe('id');
  });

  it('should return en when browser locale starts with en', async () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    const { detectLocale } = await import('@/i18n/index');
    expect(detectLocale()).toBe('en');
  });

  it('should prefer stored locale over browser locale', async () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('id'),
      setItem: vi.fn(),
    });
    const { detectLocale } = await import('@/i18n/index');
    expect(detectLocale()).toBe('id');
  });

  it('should handle undefined navigator gracefully', async () => {
    vi.stubGlobal('navigator', undefined);
    const { detectLocale } = await import('@/i18n/index');
    expect(detectLocale()).toBe('en');
  });

  it('should export detectLocale function', async () => {
    const { detectLocale } = await import('@/i18n/index');
    expect(typeof detectLocale).toBe('function');
  });
});
