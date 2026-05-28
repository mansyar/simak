import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUnreadCount, listNotifications, markRead, markAllRead } from '@/server/notifications';

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: async () => {
      const res = await (
        getUnreadCount as unknown as (args: {
          data: Record<string, never>;
        }) => Promise<{ count: number; error?: string }>
      )({ data: {} });
      if ('error' in res) {
        throw new Error(res.error);
      }
      return res.count;
    },
    refetchInterval: 15000,
  });
}

export function useNotificationsList(
  options: { page?: number; limit?: number; type?: string } = {},
) {
  const { page = 1, limit = 20, type } = options;
  return useQuery({
    queryKey: ['notifications', 'list', { page, limit, type }],
    queryFn: async () => {
      const res = await (
        listNotifications as unknown as (args: {
          data: { page: number; limit: number; type?: string };
        }) => Promise<{ items: unknown[]; total: number; error?: string }>
      )({ data: { page, limit, type } });
      if ('error' in res) {
        throw new Error(res.error);
      }
      return res;
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await (
        markRead as unknown as (args: {
          data: { notificationId: number };
        }) => Promise<{ error?: string }>
      )({ data: { notificationId } });
      if ('error' in res) {
        throw new Error(res.error);
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await (
        markAllRead as unknown as (args: {
          data: Record<string, never>;
        }) => Promise<{ error?: string }>
      )({ data: {} });
      if ('error' in res) {
        throw new Error(res.error);
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}
