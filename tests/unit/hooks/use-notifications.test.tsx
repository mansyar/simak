import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useUnreadCount,
  useNotificationsList,
  useMarkRead,
  useMarkAllRead,
} from '@/hooks/use-notifications';
import { getUnreadCount, listNotifications, markRead, markAllRead } from '@/server/notifications';

// Mocks
const mockShowErrorToast = vi.fn();

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/toast', () => ({
  parseServerError: (res: { error?: { code: string; message: string } }) =>
    res.error ? res.error : { code: 'UNKNOWN', message: '' },
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

vi.mock('@/server/notifications', () => ({
  getUnreadCount: vi.fn(),
  listNotifications: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Notification query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useUnreadCount', () => {
    it('should query the unread count and set refetchInterval to 30000', async () => {
      vi.mocked(getUnreadCount).mockResolvedValue({ count: 5 });

      const { result } = renderHook(() => useUnreadCount(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(5);
      expect(getUnreadCount).toHaveBeenCalled();
    });

    it('should set refetchInterval to 30000 and refetchIntervalInBackground to false (PERF-30)', async () => {
      vi.mocked(getUnreadCount).mockResolvedValue({ count: 5 });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUnreadCount(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const query = queryClient
        .getQueryCache()
        .find({ queryKey: ['notifications', 'unreadCount'] });
      expect((query?.options as Record<string, unknown>).refetchInterval).toBe(30000);
      expect((query?.options as Record<string, unknown>).refetchIntervalInBackground).toBe(false);
    });
  });

  describe('useNotificationsList', () => {
    it('should query notifications list with page and limit options', async () => {
      const mockResult = { items: [{ id: 1, title: 'Test' }], total: 1 };
      vi.mocked(listNotifications).mockResolvedValue(mockResult as any);

      const { result } = renderHook(
        () => useNotificationsList({ page: 2, limit: 10, type: 'review_completed' }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResult);
      expect(listNotifications).toHaveBeenCalledWith({
        data: { page: 2, limit: 10, type: 'review_completed' },
      });
    });

    it('should pass unreadOnly to listNotifications (TRACK-012 FR-3)', async () => {
      const mockResult = { items: [{ id: 1, title: 'Test' }], total: 1 };
      vi.mocked(listNotifications).mockResolvedValue(mockResult as any);

      const { result } = renderHook(
        () => useNotificationsList({ page: 1, limit: 20, unreadOnly: true }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(listNotifications).toHaveBeenCalledWith({
        data: { page: 1, limit: 20, unreadOnly: true },
      });
    });

    it('should set staleTime to 30000 (PERF-29)', async () => {
      const mockResult = { items: [{ id: 1, title: 'Test' }], total: 1 };
      vi.mocked(listNotifications).mockResolvedValue(mockResult as any);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useNotificationsList({ page: 1, limit: 20 }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const queries = queryClient.getQueryCache().getAll();
      const query = queries.find(
        (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'notifications' &&
          q.queryKey[1] === 'list',
      );
      expect((query?.options as Record<string, unknown>).staleTime).toBe(30_000);
    });
  });

  describe('useMarkRead', () => {
    it('should call markRead mutation and invalidate queries', async () => {
      vi.mocked(markRead).mockResolvedValue({ success: true } as any);

      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useMarkRead(), { wrapper });

      result.current.mutate(42);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(markRead).toHaveBeenCalledWith({ data: { notificationId: 42 } });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications', 'unreadCount'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications', 'list'] });
    });
  });

  describe('useMarkAllRead', () => {
    it('should call markAllRead mutation and invalidate queries', async () => {
      vi.mocked(markAllRead).mockResolvedValue({ success: true } as any);

      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useMarkAllRead(), { wrapper });

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(markAllRead).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications', 'unreadCount'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications', 'list'] });
    });
  });

  describe('error handling', () => {
    it('shows a toast and surfaces the typed server error for mutations', async () => {
      mockShowErrorToast.mockClear();
      vi.mocked(markRead).mockResolvedValue({
        error: { code: 'FORBIDDEN', message: 'Forbidden' },
      } as any);

      const queryClient = new QueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useMarkRead(), { wrapper });

      result.current.mutate(42);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockShowErrorToast).toHaveBeenCalledWith('FORBIDDEN', expect.any(Function));
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Forbidden');
    });
  });
});
