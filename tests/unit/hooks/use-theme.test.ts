/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/hooks/use-theme';

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

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('should initialize with system preference when no stored theme', () => {
    localStorageMock.getItem.mockReturnValue(null);
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
  });

  it('should initialize with dark system preference', () => {
    localStorageMock.getItem.mockReturnValue(null);
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
  });

  it('should initialize with stored theme', () => {
    localStorageMock.getItem.mockReturnValue('dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
  });

  it('should set theme and persist to localStorage', () => {
    localStorageMock.getItem.mockReturnValue('light');

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('simak-theme', 'dark');
  });

  it('should toggle theme from light to dark', () => {
    localStorageMock.getItem.mockReturnValue('light');

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('simak-theme', 'dark');
  });

  it('should toggle theme from dark to light', () => {
    localStorageMock.getItem.mockReturnValue('dark');

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('simak-theme', 'light');
  });

  it('should apply dark class to document when theme is dark', () => {
    localStorageMock.getItem.mockReturnValue('dark');

    renderHook(() => useTheme());

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should remove dark class from document when theme is light', () => {
    localStorageMock.getItem.mockReturnValue('light');
    document.documentElement.classList.add('dark');

    renderHook(() => useTheme());

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should listen for system preference changes', () => {
    const addEventListenerMock = vi.fn();
    localStorageMock.getItem.mockReturnValue(null);
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: addEventListenerMock,
      removeEventListener: vi.fn(),
    });

    renderHook(() => useTheme());

    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should cleanup event listener on unmount', () => {
    const removeEventListenerMock = vi.fn();
    localStorageMock.getItem.mockReturnValue(null);
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerMock,
    });

    const { unmount } = renderHook(() => useTheme());

    unmount();

    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
