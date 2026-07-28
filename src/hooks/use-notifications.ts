import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUnreadCount, listNotifications, markRead, markAllRead } from '@/server/notifications';
import { useI18n } from '@/routes/__root';
import { parseServerError, showErrorToast } from '@/lib/toast';
import { notificationKeys } from '@/lib/query-keys';

export function useUnreadCount() {
  const { t } = useI18n();
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const res = await getUnreadCount({ data: {} });
      if ('error' in res) {
        const parsed = parseServerError(res);
        showErrorToast(parsed.code, t);
        throw new Error(parsed.message);
      }
      return res.count;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

export function useNotificationsList(
  options: { limit?: number; type?: string; unreadOnly?: boolean } = {},
) {
  const { t } = useI18n();
  const { limit = 20, type, unreadOnly } = options;
  return useInfiniteQuery({
    queryKey: notificationKeys.list({ limit, type, unreadOnly }),
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const res = await listNotifications({ data: { page: pageParam, limit, type, unreadOnly } });
      if ('error' in res) {
        const parsed = parseServerError(res);
        showErrorToast(parsed.code, t);
        throw new Error(parsed.message);
      }
      return res;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalItems = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return totalItems < lastPage.total ? allPages.length + 1 : undefined;
    },
    staleTime: 30_000,
  });
}

export function useMarkRead() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await markRead({ data: { notificationId } });
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
        if (old && typeof old === 'object' && 'pages' in old) {
          const infiniteData = old as {
            pages: Array<{ items: Array<{ id: number; read: boolean }>; total: number }>;
            pageParams: number[];
          };
          return {
            ...infiniteData,
            pages: infiniteData.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === notificationId ? { ...item, read: true } : item,
              ),
            })),
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
      const res = await markAllRead({ data: {} });
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
        if (old && typeof old === 'object' && 'pages' in old) {
          const infiniteData = old as {
            pages: Array<{ items: Array<{ id: number; read: boolean }>; total: number }>;
            pageParams: number[];
          };
          return {
            ...infiniteData,
            pages: infiniteData.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => ({ ...item, read: true })),
            })),
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
