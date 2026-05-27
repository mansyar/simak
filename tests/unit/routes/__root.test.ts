/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia
const matchMediaMock = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));
Object.defineProperty(window, 'matchMedia', { value: matchMediaMock });

// Mock the i18n module
vi.mock('@/i18n/index', () => ({
  detectLocale: vi.fn().mockReturnValue('en'),
}));

describe('Root route i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export useI18n hook', async () => {
    const { useI18n } = await import('@/routes/__root');
    expect(typeof useI18n).toBe('function');
  });

  it('should export Route', async () => {
    const { Route } = await import('@/routes/__root');
    expect(Route).toBeDefined();
  });
});
