import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUnreadCount, listNotifications, markRead, markAllRead } from '@/server/notifications';
import { useI18n } from '@/routes/__root';
import { parseServerError, showErrorToast } from '@/lib/toast';

function handleServerError<T extends { error?: unknown }>(
  res: T,
  t: ReturnType<typeof useI18n>['t'],
) {
  if ('error' in res) {
    const parsed = parseServerError(res);
    showErrorToast(parsed.code, t);
    throw new Error(parsed.message);
  }
}

export function useUnreadCount() {
  const { t } = useI18n();
  return useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: async () => {
      const res = await (
        getUnreadCount as unknown as (args: {
          data: Record<string, never>;
        }) => Promise<{ count: number; error?: { code: string; message: string } }>
      )({ data: {} });
      handleServerError(res, t);
      return res.count;
    },
    refetchInterval: 15000,
  });
}

export function useNotificationsList(
  options: { page?: number; limit?: number; type?: string; unreadOnly?: boolean } = {},
) {
  const { t } = useI18n();
  const { page = 1, limit = 20, type, unreadOnly } = options;
  return useQuery({
    queryKey: ['notifications', 'list', { page, limit, type, unreadOnly }],
    queryFn: async () => {
      const res = await (
        listNotifications as unknown as (args: {
          data: { page: number; limit: number; type?: string; unreadOnly?: boolean };
        }) => Promise<{
          items: unknown[];
          total: number;
          error?: { code: string; message: string };
        }>
      )({ data: { page, limit, type, unreadOnly } });
      handleServerError(res, t);
      return res;
    },
  });
}

export function useMarkRead() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await (
        markRead as unknown as (args: {
          data: { notificationId: number };
        }) => Promise<{ error?: { code: string; message: string } }>
      )({ data: { notificationId } });
      handleServerError(res, t);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}

export function useMarkAllRead() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await (
        markAllRead as unknown as (args: {
          data: Record<string, never>;
        }) => Promise<{ error?: { code: string; message: string } }>
      )({ data: {} });
      handleServerError(res, t);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}
