import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useUnreadCount, useNotificationsList } from '@/hooks/use-notifications';
import { getUnreadCount, listNotifications } from '@/server/notifications';
import { notificationKeys } from '@/lib/query-keys';

// Mocks
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/toast', () => ({
  parseServerError: (res: { error?: { code: string; message: string } }) =>
    res.error ? res.error : { code: 'UNKNOWN', message: '' },
  showErrorToast: vi.fn(),
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

      const query = queryClient.getQueryCache().find({ queryKey: notificationKeys.unreadCount() });
      expect((query?.options as Record<string, unknown>).refetchInterval).toBe(30000);
      expect((query?.options as Record<string, unknown>).refetchIntervalInBackground).toBe(false);
    });
  });

  describe('useNotificationsList', () => {
    it('should use useInfiniteQuery with initialPageParam 1', async () => {
      const mockResult = { items: [{ id: 1, title: 'Test' }], total: 1 };
      vi.mocked(listNotifications).mockResolvedValue(mockResult as any);

      const { result } = renderHook(() => useNotificationsList({ limit: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // listNotifications called with page: 1 (initialPageParam)
      expect(listNotifications).toHaveBeenCalledWith({
        data: { page: 1, limit: 20 },
      });
    });

    it('should pass unreadOnly to listNotifications (TRACK-012 FR-3)', async () => {
      const mockResult = { items: [{ id: 1, title: 'Test' }], total: 1 };
      vi.mocked(listNotifications).mockResolvedValue(mockResult as any);

      const { result } = renderHook(() => useNotificationsList({ limit: 20, unreadOnly: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(listNotifications).toHaveBeenCalledWith({
        data: { page: 1, limit: 20, unreadOnly: true },
      });
    });

    it('should exclude page from queryKey (managed by pageParam)', async () => {
      const mockResult = { items: [{ id: 1, title: 'Test' }], total: 1 };
      vi.mocked(listNotifications).mockResolvedValue(mockResult as any);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(
        () => useNotificationsList({ limit: 20, type: 'review_completed', unreadOnly: true }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query key should be notificationKeys.list({ limit, type, unreadOnly }) — no page
      const query = queryClient.getQueryCache().find({
        queryKey: notificationKeys.list({ limit: 20, type: 'review_completed', unreadOnly: true }),
      });
      expect(query).toBeDefined();
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

      const { result } = renderHook(() => useNotificationsList({ limit: 20 }), {
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

    it('should have hasNextPage true when total > accumulated items', async () => {
      vi.mocked(listNotifications).mockResolvedValue({
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        total: 10,
      } as any);

      const { result } = renderHook(() => useNotificationsList({ limit: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasNextPage).toBe(true);
    });

    it('should have hasNextPage false when all items are loaded', async () => {
      vi.mocked(listNotifications).mockResolvedValue({
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        total: 3,
      } as any);

      const { result } = renderHook(() => useNotificationsList({ limit: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasNextPage).toBe(false);
    });

    it('should expose fetchNextPage on the result', async () => {
      vi.mocked(listNotifications).mockResolvedValue({
        items: [{ id: 1 }],
        total: 5,
      } as any);

      const { result } = renderHook(() => useNotificationsList({ limit: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.fetchNextPage).toBe('function');
    });

    it('should fetch next page with pageParam when fetchNextPage is called', async () => {
      vi.mocked(listNotifications).mockImplementation(((args: any) => {
        const page = args.data.page;
        if (page === 1) {
          return Promise.resolve({ items: [{ id: 1 }, { id: 2 }], total: 5 });
        }
        return Promise.resolve({ items: [{ id: 3 }, { id: 4 }], total: 5 });
      }) as any);

      const { result } = renderHook(() => useNotificationsList({ limit: 2 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(listNotifications).toHaveBeenCalledWith({
        data: { page: 1, limit: 2 },
      });

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(listNotifications).toHaveBeenCalledWith({
          data: { page: 2, limit: 2 },
        });
      });
    });

    it('should expose accumulated items across multiple pages via data.pages', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      // Pre-populate cache with infinite query data shape (2 pages)
      queryClient.setQueryData(notificationKeys.list({ limit: 2 }), {
        pages: [
          { items: [{ id: 1 }, { id: 2 }], total: 4 },
          { items: [{ id: 3 }, { id: 4 }], total: 4 },
        ],
        pageParams: [1, 2],
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useNotificationsList({ limit: 2 }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.pages).toHaveLength(2);
      const allItems = result.current.data?.pages.flatMap((p: any) => p.items) ?? [];
      expect(allItems).toHaveLength(4);
      expect(allItems.map((i: any) => i.id)).toEqual([1, 2, 3, 4]);
    });
  });
});
