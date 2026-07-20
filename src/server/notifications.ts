// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in notifications.server.ts
import { createServerFn } from '@tanstack/react-start';
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

export const createNotification = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { createNotificationHandler } = await import('./notifications.server');
    const data = CreateNotificationSchema.parse(args.data);
    return createNotificationHandler({ data });
  },
);

export const listNotifications = createServerFn({ method: 'GET' }).handler(
  async (args: { data: unknown }) => {
    const { listNotificationsHandler } = await import('./notifications.server');
    const data = ListNotificationsSchema.parse(args.data);
    return listNotificationsHandler({ data });
  },
);

// --- Phase 1: New schemas and stubs ---

export const MarkReadSchema = z.object({
  notificationId: z.coerce.number().int().min(1, 'Notification ID is required'),
});

export const MarkAllReadSchema = z.object({});

export const GetUnreadCountSchema = z.object({});

export const markRead = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { markReadHandler } = await import('./notifications.server');
    const data = MarkReadSchema.parse(args.data);
    return markReadHandler({ data });
  },
);

export const markAllRead = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { markAllReadHandler } = await import('./notifications.server');
    const data = MarkAllReadSchema.parse(args.data);
    return markAllReadHandler({ data });
  },
);

export const getUnreadCount = createServerFn({ method: 'GET' }).handler(
  async (args: { data: unknown }) => {
    const { getUnreadCountHandler } = await import('./notifications.server');
    const data = GetUnreadCountSchema.parse(args.data);
    return getUnreadCountHandler({ data });
  },
);
