/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectLocale } from '@/i18n/index';
// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
// Mock navigator
const navigatorMock = {
  language: 'en-US',
};
Object.defineProperty(window, 'navigator', { value: navigatorMock, writable: true });
describe('i18n module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('detectLocale', () => {
    it('should return stored locale when available', () => {
      localStorageMock.getItem.mockReturnValue('id');
      const result = detectLocale();
      expect(result).toBe('id');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('simak-locale');
    });
    it('should return stored locale "en" when available', () => {
      localStorageMock.getItem.mockReturnValue('en');
      const result = detectLocale();
      expect(result).toBe('en');
    });
    it('should return browser locale when no stored locale', () => {
      localStorageMock.getItem.mockReturnValue(null);
      navigatorMock.language = 'id-ID';
      const result = detectLocale();
      expect(result).toBe('id');
    });
    it('should return browser locale "en" when no stored locale', () => {
      localStorageMock.getItem.mockReturnValue(null);
      navigatorMock.language = 'en-US';
      const result = detectLocale();
      expect(result).toBe('en');
    });
    it('should return fallback "en" when no stored or browser locale', () => {
      localStorageMock.getItem.mockReturnValue(null);
      navigatorMock.language = 'fr-FR';
      const result = detectLocale();
      expect(result).toBe('en');
    });
    it('should return fallback "en" when stored locale is invalid', () => {
      localStorageMock.getItem.mockReturnValue('fr');
      const result = detectLocale();
      expect(result).toBe('en');
    });
    it('should prioritize stored locale over browser locale', () => {
      localStorageMock.getItem.mockReturnValue('id');
      navigatorMock.language = 'en-US';
      const result = detectLocale();
      expect(result).toBe('id');
    });
    it('should handle Indonesian browser locale variations', () => {
      localStorageMock.getItem.mockReturnValue(null);
      navigatorMock.language = 'id';
      const result = detectLocale();
      expect(result).toBe('id');
    });
    it('should handle English browser locale variations', () => {
      localStorageMock.getItem.mockReturnValue(null);
      navigatorMock.language = 'en-GB';
      const result = detectLocale();
      expect(result).toBe('en');
    });
    it('should return fallback for unsupported browser locale', () => {
      localStorageMock.getItem.mockReturnValue(null);
      navigatorMock.language = 'ja-JP';
      const result = detectLocale();
      expect(result).toBe('en');
    });
  });
});
