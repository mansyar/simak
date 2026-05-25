// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in notifications.server.ts
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const CreateNotificationSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  type: z.string().min(1, 'Type is required'),
  title: z.string().min(1, 'Title is required'),
  message: z.string().optional(),
  channel: z.enum(['in_app', 'email'], { message: 'Channel must be in_app or email' }),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const ListNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().optional(),
});

export const createNotification = createServerFn({ method: 'POST' }).handler(
  async (args: { data: any }) => {
    const { createNotificationHandler } = await import('./notifications.server');
    const data = CreateNotificationSchema.parse(args.data);
    return createNotificationHandler({ data });
  },
);

export const listNotifications = createServerFn({ method: 'GET' }).handler(
  async (args: { data: any }) => {
    const { listNotificationsHandler } = await import('./notifications.server');
    const data = ListNotificationsSchema.parse(args.data);
    return listNotificationsHandler({ data });
  },
);
