import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useUnreadCount,
  useNotificationsList,
  useMarkRead,
  useMarkAllRead,
} from '@/hooks/use-notifications';
import { getUnreadCount, listNotifications, markRead, markAllRead } from '@/server/notifications';
// Mock server functions
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
  return ({ children }) => _jsx(QueryClientProvider, { client: queryClient, children: children });
}
describe('Notification query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('useUnreadCount', () => {
    it('should query the unread count and set refetchInterval to 15000', async () => {
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
  });
  describe('useNotificationsList', () => {
    it('should query notifications list with page and limit options', async () => {
      const mockResult = { items: [{ id: 1, title: 'Test' }], total: 1 };
      vi.mocked(listNotifications).mockResolvedValue(mockResult);
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
  });
  describe('useMarkRead', () => {
    it('should call markRead mutation and invalidate queries', async () => {
      vi.mocked(markRead).mockResolvedValue({ success: true });
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const wrapper = ({ children }) =>
        _jsx(QueryClientProvider, { client: queryClient, children: children });
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
      vi.mocked(markAllRead).mockResolvedValue({ success: true });
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const wrapper = ({ children }) =>
        _jsx(QueryClientProvider, { client: queryClient, children: children });
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
});
