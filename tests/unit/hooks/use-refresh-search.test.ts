/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useRefreshSearch } from '@/hooks/use-refresh-search';

describe('useRefreshSearch', () => {
  it('should return isRefreshing as false initially', () => {
    const { result } = renderHook(() => useRefreshSearch());
    expect(result.current.isRefreshing).toBe(false);
  });

  it('should set isRefreshing to true during refresh', async () => {
    const { result } = renderHook(() => useRefreshSearch());
    let resolveRefresh: () => void;
    const refreshPromise = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });

    act(() => {
      result.current.refresh(() => refreshPromise);
    });

    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      resolveRefresh!();
      await refreshPromise;
    });

    expect(result.current.isRefreshing).toBe(false);
  });

  it('should call the callback function', async () => {
    const { result } = renderHook(() => useRefreshSearch());
    const callback = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.refresh(callback);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
