import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMarkRead, useMarkAllRead } from '@/hooks/use-notifications';
import { markRead, markAllRead } from '@/server/notifications';
import { notificationKeys } from '@/lib/query-keys';

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

function createOptimisticWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('Notification mutation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: notificationKeys.all() });
    });
  });

  describe('useMarkRead - optimistic updates', () => {
    it('should optimistically flip read to true on the targeted notification in the list cache', async () => {
      const mockInfinite = {
        pages: [
          {
            items: [
              { id: 42, read: false, title: 'Test' },
              { id: 43, read: false, title: 'Test 2' },
            ],
            total: 2,
          },
        ],
        pageParams: [1],
      };
      vi.mocked(markRead).mockResolvedValue({ success: true } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();
      queryClient.setQueryData(notificationKeys.list({ limit: 20 }), mockInfinite);

      const { result } = renderHook(() => useMarkRead(), { wrapper });
      result.current.mutate(42);

      await waitFor(() => {
        const listData = queryClient.getQueryData(notificationKeys.list({ limit: 20 })) as {
          pages: Array<{ items: Array<{ id: number; read: boolean }>; total: number }>;
          pageParams: number[];
        };
        expect(listData.pages[0].items[0].read).toBe(true);
        expect(listData.pages[0].items[1].read).toBe(false);
      });
    });

    it('should optimistically decrement the unread count', async () => {
      vi.mocked(markRead).mockResolvedValue({ success: true } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();
      queryClient.setQueryData(notificationKeys.unreadCount(), 5);

      const { result } = renderHook(() => useMarkRead(), { wrapper });
      result.current.mutate(42);

      await waitFor(() => {
        expect(queryClient.getQueryData(notificationKeys.unreadCount())).toBe(4);
      });
    });

    it('should restore the list cache on error', async () => {
      const mockInfinite = {
        pages: [
          {
            items: [{ id: 42, read: false, title: 'Test' }],
            total: 1,
          },
        ],
        pageParams: [1],
      };
      vi.mocked(markRead).mockResolvedValue({
        error: { code: 'FORBIDDEN', message: 'Forbidden' },
      } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();
      queryClient.setQueryData(notificationKeys.list({ limit: 20 }), mockInfinite);

      const { result } = renderHook(() => useMarkRead(), { wrapper });
      result.current.mutate(42);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      const listData = queryClient.getQueryData(notificationKeys.list({ limit: 20 })) as {
        pages: Array<{ items: Array<{ id: number; read: boolean }>; total: number }>;
        pageParams: number[];
      };
      expect(listData.pages[0].items[0].read).toBe(false);
    });

    it('should restore the unread count on error', async () => {
      vi.mocked(markRead).mockResolvedValue({
        error: { code: 'FORBIDDEN', message: 'Forbidden' },
      } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();
      queryClient.setQueryData(notificationKeys.unreadCount(), 5);

      const { result } = renderHook(() => useMarkRead(), { wrapper });
      result.current.mutate(42);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(queryClient.getQueryData(notificationKeys.unreadCount())).toBe(5);
    });

    it('should show error toast on rollback', async () => {
      mockShowErrorToast.mockClear();
      vi.mocked(markRead).mockResolvedValue({
        error: { code: 'FORBIDDEN', message: 'Forbidden' },
      } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();

      const { result } = renderHook(() => useMarkRead(), { wrapper });
      result.current.mutate(42);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockShowErrorToast).toHaveBeenCalledWith('FORBIDDEN', expect.any(Function));
    });

    it('should optimistically update the correct item across multiple pages', async () => {
      const mockInfinite = {
        pages: [
          {
            items: [{ id: 42, read: false, title: 'Page 1 Item' }],
            total: 2,
          },
          {
            items: [{ id: 43, read: false, title: 'Page 2 Item' }],
            total: 2,
          },
        ],
        pageParams: [1, 2],
      };
      vi.mocked(markRead).mockResolvedValue({ success: true } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();
      queryClient.setQueryData(notificationKeys.list({ limit: 20 }), mockInfinite);

      const { result } = renderHook(() => useMarkRead(), { wrapper });
      result.current.mutate(43);

      await waitFor(() => {
        const listData = queryClient.getQueryData(notificationKeys.list({ limit: 20 })) as {
          pages: Array<{ items: Array<{ id: number; read: boolean }>; total: number }>;
          pageParams: number[];
        };
        expect(listData.pages[0].items[0].read).toBe(false);
        expect(listData.pages[1].items[0].read).toBe(true);
      });
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
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: notificationKeys.all() });
    });
  });

  describe('useMarkAllRead - optimistic updates', () => {
    it('should optimistically flip read to true on all notifications in the list cache', async () => {
      const mockInfinite = {
        pages: [
          {
            items: [
              { id: 42, read: false, title: 'Test' },
              { id: 43, read: false, title: 'Test 2' },
            ],
            total: 2,
          },
        ],
        pageParams: [1],
      };
      vi.mocked(markAllRead).mockResolvedValue({ success: true } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();
      queryClient.setQueryData(notificationKeys.list({ limit: 20 }), mockInfinite);

      const { result } = renderHook(() => useMarkAllRead(), { wrapper });
      result.current.mutate();

      await waitFor(() => {
        const listData = queryClient.getQueryData(notificationKeys.list({ limit: 20 })) as {
          pages: Array<{ items: Array<{ id: number; read: boolean }>; total: number }>;
          pageParams: number[];
        };
        expect(listData.pages[0].items[0].read).toBe(true);
        expect(listData.pages[0].items[1].read).toBe(true);
      });
    });

    it('should optimistically set the unread count to 0', async () => {
      vi.mocked(markAllRead).mockResolvedValue({ success: true } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();
      queryClient.setQueryData(notificationKeys.unreadCount(), 5);

      const { result } = renderHook(() => useMarkAllRead(), { wrapper });
      result.current.mutate();

      await waitFor(() => {
        expect(queryClient.getQueryData(notificationKeys.unreadCount())).toBe(0);
      });
    });

    it('should restore the list cache on error', async () => {
      const mockInfinite = {
        pages: [
          {
            items: [
              { id: 42, read: false, title: 'Test' },
              { id: 43, read: true, title: 'Test 2' },
            ],
            total: 2,
          },
        ],
        pageParams: [1],
      };
      vi.mocked(markAllRead).mockResolvedValue({
        error: { code: 'FORBIDDEN', message: 'Forbidden' },
      } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();
      queryClient.setQueryData(notificationKeys.list({ limit: 20 }), mockInfinite);

      const { result } = renderHook(() => useMarkAllRead(), { wrapper });
      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      const listData = queryClient.getQueryData(notificationKeys.list({ limit: 20 })) as {
        pages: Array<{ items: Array<{ id: number; read: boolean }>; total: number }>;
        pageParams: number[];
      };
      expect(listData.pages[0].items[0].read).toBe(false);
      expect(listData.pages[0].items[1].read).toBe(true);
    });

    it('should restore the unread count on error', async () => {
      vi.mocked(markAllRead).mockResolvedValue({
        error: { code: 'FORBIDDEN', message: 'Forbidden' },
      } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();
      queryClient.setQueryData(notificationKeys.unreadCount(), 5);

      const { result } = renderHook(() => useMarkAllRead(), { wrapper });
      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(queryClient.getQueryData(notificationKeys.unreadCount())).toBe(5);
    });

    it('should show error toast on rollback', async () => {
      mockShowErrorToast.mockClear();
      vi.mocked(markAllRead).mockResolvedValue({
        error: { code: 'FORBIDDEN', message: 'Forbidden' },
      } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();

      const { result } = renderHook(() => useMarkAllRead(), { wrapper });
      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockShowErrorToast).toHaveBeenCalledWith('FORBIDDEN', expect.any(Function));
    });

    it('should optimistically set read to true in all loaded pages', async () => {
      const mockInfinite = {
        pages: [
          {
            items: [{ id: 42, read: false, title: 'Page 1 Item' }],
            total: 2,
          },
          {
            items: [{ id: 43, read: false, title: 'Page 2 Item' }],
            total: 2,
          },
        ],
        pageParams: [1, 2],
      };
      vi.mocked(markAllRead).mockResolvedValue({ success: true } as any);

      const { queryClient, wrapper } = createOptimisticWrapper();
      queryClient.setQueryData(notificationKeys.list({ limit: 20 }), mockInfinite);

      const { result } = renderHook(() => useMarkAllRead(), { wrapper });
      result.current.mutate();

      await waitFor(() => {
        const listData = queryClient.getQueryData(notificationKeys.list({ limit: 20 })) as {
          pages: Array<{ items: Array<{ id: number; read: boolean }>; total: number }>;
          pageParams: number[];
        };
        expect(listData.pages[0].items[0].read).toBe(true);
        expect(listData.pages[1].items[0].read).toBe(true);
      });
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
