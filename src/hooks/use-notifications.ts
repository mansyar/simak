import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUnreadCount, listNotifications, markRead, markAllRead } from '@/server/notifications';
import { useI18n } from '@/routes/__root';
import { parseServerError, showErrorToast } from '@/lib/toast';
import { notificationKeys } from '@/lib/query-keys';

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
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const res = await (
        getUnreadCount as unknown as (args: {
          data: Record<string, never>;
        }) => Promise<{ count: number; error?: { code: string; message: string } }>
      )({ data: {} });
      handleServerError(res, t);
      return res.count;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

export function useNotificationsList(
  options: { page?: number; limit?: number; type?: string; unreadOnly?: boolean } = {},
) {
  const { t } = useI18n();
  const { page = 1, limit = 20, type, unreadOnly } = options;
  return useQuery({
    queryKey: notificationKeys.list({ page, limit, type, unreadOnly }),
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
    staleTime: 30_000,
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
      if ('error' in res) {
        const parsed = parseServerError(res);
        const error = new Error(parsed.message) as Error & { code: string };
        error.code = parsed.code;
        throw error;
      }
      return res;
    },
    onMutate: async (notificationId: number) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all() });

      const previousEntries = queryClient.getQueriesData({
        queryKey: notificationKeys.all(),
      });

      queryClient.setQueriesData({ queryKey: notificationKeys.all() }, (old: unknown) => {
        if (typeof old === 'number') {
          return Math.max(0, old - 1);
        }
        if (old && typeof old === 'object' && 'items' in old) {
          const listData = old as { items: Array<{ id: number; read: boolean }>; total: number };
          return {
            ...listData,
            items: listData.items.map((item) =>
              item.id === notificationId ? { ...item, read: true } : item,
            ),
          };
        }
        return old;
      });

      return { previousEntries };
    },
    onError: (error, _variables, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, data] of context.previousEntries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      const err = error as Error & { code?: string };
      showErrorToast(err.code ?? 'UNKNOWN', t);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
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
      if ('error' in res) {
        const parsed = parseServerError(res);
        const error = new Error(parsed.message) as Error & { code: string };
        error.code = parsed.code;
        throw error;
      }
      return res;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all() });

      const previousEntries = queryClient.getQueriesData({
        queryKey: notificationKeys.all(),
      });

      queryClient.setQueriesData({ queryKey: notificationKeys.all() }, (old: unknown) => {
        if (typeof old === 'number') {
          return 0;
        }
        if (old && typeof old === 'object' && 'items' in old) {
          const listData = old as { items: Array<{ id: number; read: boolean }>; total: number };
          return {
            ...listData,
            items: listData.items.map((item) => ({ ...item, read: true })),
          };
        }
        return old;
      });

      return { previousEntries };
    },
    onError: (error, _variables, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, data] of context.previousEntries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      const err = error as Error & { code?: string };
      showErrorToast(err.code ?? 'UNKNOWN', t);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
    },
  });
}
