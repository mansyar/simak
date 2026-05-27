import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function createMediaQueryMock(matches: boolean) {
  return {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };
}

describe('useTheme - internal functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    document.documentElement.classList.remove('dark');
  });

  it('should return light theme when system prefers light', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(createMediaQueryMock(false) as any);

    const mod = await import('@/hooks/use-theme');
    const { result } = renderHook(() => mod.useTheme());

    expect(result.current.theme).toBe('light');
  });

  it('should return dark theme when system preference is dark', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(createMediaQueryMock(true) as any);

    const mod = await import('@/hooks/use-theme');
    const { result } = renderHook(() => mod.useTheme());

    expect(result.current.theme).toBe('dark');
  });

  it('should return stored theme when one is set', async () => {
    localStorageMock.getItem.mockReturnValue('dark');

    const mod = await import('@/hooks/use-theme');
    const { result } = renderHook(() => mod.useTheme());

    expect(result.current.theme).toBe('dark');
  });

  it('should set theme via setTheme and apply dark class', async () => {
    localStorageMock.getItem.mockReturnValue('light');

    const mod = await import('@/hooks/use-theme');
    const { result } = renderHook(() => mod.useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith('simak-theme', 'dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should toggle theme between light and dark', async () => {
    localStorageMock.getItem.mockReturnValue('light');

    const mod = await import('@/hooks/use-theme');
    const { result } = renderHook(() => mod.useTheme());

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
  });

  it('should remove dark class when setting light theme', async () => {
    localStorageMock.getItem.mockReturnValue('dark');

    const mod = await import('@/hooks/use-theme');
    const { result } = renderHook(() => mod.useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => result.current.setTheme('light'));
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should not update on system change when stored theme exists', async () => {
    localStorageMock.getItem.mockReturnValue('dark');

    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    const mediaQueryMock = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQueryMock as any);

    const mod = await import('@/hooks/use-theme');
    const { result } = renderHook(() => mod.useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => {
      listeners['change']?.[0]?.();
    });

    expect(result.current.theme).toBe('dark');
  });
});
