// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in notifications.server.ts
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const CreateNotificationSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  type: z.string().min(1, 'Type is required'),
  titleKey: z.string().optional(),
  messageKey: z.string().optional(),
  params: z.record(z.string(), z.string()).optional(),
  channel: z.enum(['in_app', 'email'], { message: 'Channel must be in_app or email' }),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const ListNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().optional(),
  unreadOnly: z.boolean().optional(),
});

export const createNotification = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .handler(async (args: { data: unknown }) => {
    const data = CreateNotificationSchema.parse(args.data);
    const { createNotificationHandler } = await import('./notifications.server');
    return createNotificationHandler({ data });
  });

export const listNotifications = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async (args: { data: unknown }) => {
    const data = ListNotificationsSchema.parse(args.data);
    const { listNotificationsHandler } = await import('./notifications.server');
    return listNotificationsHandler({ data });
  });

// --- Phase 1: New schemas and stubs ---

export const MarkReadSchema = z.object({
  notificationId: z.coerce.number().int().min(1, 'Notification ID is required'),
});

export const MarkAllReadSchema = z.object({});

export const GetUnreadCountSchema = z.object({});

export const markRead = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares())
  .handler(async (args: { data: unknown }) => {
    const data = MarkReadSchema.parse(args.data);
    const { markReadHandler } = await import('./notifications.server');
    return markReadHandler({ data });
  });

export const markAllRead = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares())
  .handler(async (args: { data: unknown }) => {
    const data = MarkAllReadSchema.parse(args.data);
    const { markAllReadHandler } = await import('./notifications.server');
    return markAllReadHandler({ data });
  });

export const getUnreadCount = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares())
  .handler(async (args: { data: unknown }) => {
    const data = GetUnreadCountSchema.parse(args.data);
    const { getUnreadCountHandler } = await import('./notifications.server');
    return getUnreadCountHandler({ data });
  });
