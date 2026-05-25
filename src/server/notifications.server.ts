// Server-only handlers for notification operations
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { notifications } from '../db/schema/notifications';
import { getSessionFromHeaders } from './auth';
import type { z } from 'zod';
import type { CreateNotificationSchema, ListNotificationsSchema } from './notifications';

type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
type ListNotificationsInput = z.infer<typeof ListNotificationsSchema>;

function isAdmin(session: any): session is { user: { id: string; role: string }; session: any } {
  return !!session && (session.user.role === 'superadmin' || session.user.role === 'admin');
}

function isAuthenticated(
  session: any,
): session is { user: { id: string; role: string }; session: any } {
  return !!session;
}

/**
 * Create a notification row.
 * Requires authentication (used server-side by other handlers, but also callable).
 */
export async function createNotificationHandler(args: { data: CreateNotificationInput }) {
  const session = await getSessionFromHeaders();
  if (!isAuthenticated(session)) {
    return { error: 'Unauthorized' };
  }

  const { userId, type, title, message, channel, metadata } = args.data;
  const db = getDb();

  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        type,
        title,
        message: message || null,
        channel,
        metadata: metadata || null,
      })
      .returning();

    return { notification };
  } catch (err) {
    console.error('Failed to create notification:', err);
    return { error: 'Internal Server Error' };
  }
}

/**
 * List notifications with pagination and optional type filter.
 * Ordered by newest first.
 */
export async function listNotificationsHandler(args: { data: ListNotificationsInput }) {
  const session = await getSessionFromHeaders();
  if (!isAuthenticated(session)) {
    return { error: 'Unauthorized' };
  }

  const { page, limit, type } = args.data;
  const db = getDb();

  try {
    // Build conditions
    const conditions = [eq(notifications.userId, session.user.id)];
    if (type) {
      conditions.push(eq(notifications.type, type));
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions));

    // Fetch paginated results
    const items = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      items,
      total: Number(count),
    };
  } catch (err) {
    console.error('Failed to list notifications:', err);
    return { error: 'Internal Server Error' };
  }
}
