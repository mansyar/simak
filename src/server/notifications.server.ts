// Server-only handlers for notification operations
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { notifications } from '../db/schema/notifications';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '@/lib/errors';
import type { NonNullableSession } from '../lib/types';
import type { Locales } from '../i18n/types';
import type { z } from 'zod';
import type {
  CreateNotificationSchema,
  ListNotificationsSchema,
  MarkReadSchema,
  MarkAllReadSchema,
  GetUnreadCountSchema,
} from './notifications';
import { resolveNotificationContent, getNotificationKeys } from '../lib/i18n-server';

export { resolveNotificationContent, getNotificationKeys };

type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
type ListNotificationsInput = z.infer<typeof ListNotificationsSchema>;
type MarkReadInput = z.infer<typeof MarkReadSchema>;
type MarkAllReadInput = z.infer<typeof MarkAllReadSchema>;
type GetUnreadCountInput = z.infer<typeof GetUnreadCountSchema>;

function isAdmin(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && (session.user.role === 'superadmin' || session.user.role === 'admin');
}

function isAuthenticated(session: NonNullableSession | null): session is NonNullableSession {
  return !!session;
}

/**
 * Create a notification row.
 * Admin-only — other handlers create notifications via direct DB inserts in transactions.
 */
export async function createNotificationHandler(args: { data: CreateNotificationInput }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { userId, type, titleKey, messageKey, params, channel, metadata } = args.data;
  const db = getDb();

  try {
    const keys = getNotificationKeys(type);
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        type,
        titleKey: titleKey ?? keys.titleKey,
        messageKey: messageKey ?? keys.messageKey,
        params: (params as Record<string, string> | undefined) ?? null,
        channel,
        metadata: (metadata as Record<string, unknown>) || null,
      })
      .returning();

    return { notification: notification as never };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'createNotificationHandler',
    });
  }
}

/**
 * List notifications with pagination and optional type filter.
 * Ordered by newest first.
 */
export async function listNotificationsHandler(args: { data: ListNotificationsInput }) {
  const session = await getSessionFromHeaders();
  if (!isAuthenticated(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { page, limit, type, unreadOnly } = args.data;
  const db = getDb();

  try {
    // Use session.user.locale directly (already enriched in auth.ts via _getSession)
    const locale: Locales = (session.user.locale as Locales) ?? 'en';

    // Build conditions
    const conditions = [eq(notifications.userId, session.user.id)];
    if (type) {
      conditions.push(eq(notifications.type, type));
    }
    if (unreadOnly) {
      conditions.push(eq(notifications.read, false));
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions));

    // Fetch paginated results — narrow SELECT to only needed columns (PERF-23)
    // metadata is included for notification navigation (TRACK-012)
    const items = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        titleKey: notifications.titleKey,
        messageKey: notifications.messageKey,
        params: notifications.params,
        read: notifications.read,
        metadata: notifications.metadata,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    // Construct response objects explicitly — no ...item spread (PERF-23)
    const hydratedItems = items.map((item) => {
      const base = {
        id: item.id,
        type: item.type,
        titleKey: item.titleKey,
        messageKey: item.messageKey,
        params: item.params,
        read: item.read,
        metadata: item.metadata,
        createdAt: item.createdAt,
      };
      if (item.titleKey) {
        return {
          ...base,
          ...resolveNotificationContent(
            item.titleKey,
            item.messageKey ?? null,
            item.params,
            locale,
          ),
        };
      }
      // Expand-phase fallback: legacy rows without stored keys
      return base;
    });

    return {
      items: hydratedItems as never,
      total: Number(count),
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listNotificationsHandler',
    });
  }
}

// --- Phase 1: New handler implementations ---

/**
 * Mark a single notification as read.
 * Validates ownership — only the notification owner can mark it as read.
 */
export async function markReadHandler(args: { data: MarkReadInput }) {
  const session = await getSessionFromHeaders();
  if (!isAuthenticated(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { notificationId } = args.data;
  const db = getDb();

  try {
    // Verify the notification exists and belongs to the current user
    const [existing] = await db
      .select({ id: notifications.id, userId: notifications.userId, read: notifications.read })
      .from(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, session.user.id)));

    if (!existing) {
      return serverError(ErrorCode.NOT_FOUND, 'Notification not found');
    }

    await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'markReadHandler',
    });
  }
}

/**
 * Mark all unread notifications as read for the current user.
 */
export async function markAllReadHandler(_args: { data: MarkAllReadInput }) {
  const session = await getSessionFromHeaders();
  if (!isAuthenticated(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();

  try {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)));

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'markAllReadHandler',
    });
  }
}

/**
 * Get the count of unread notifications for the current user.
 */
export async function getUnreadCountHandler(_args: { data: GetUnreadCountInput }) {
  const session = await getSessionFromHeaders();
  if (!isAuthenticated(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)));

    return { count: Number(count) };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getUnreadCountHandler',
    });
  }
}
