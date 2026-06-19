// Server-only handlers for notification operations
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { notifications } from '../db/schema/notifications';
import { getSessionFromHeaders } from './auth';
function isAdmin(session) {
  return !!session && (session.user.role === 'superadmin' || session.user.role === 'admin');
}
function isAuthenticated(session) {
  return !!session;
}
/**
 * Create a notification row.
 * Admin-only — other handlers create notifications via direct DB inserts in transactions.
 */
export async function createNotificationHandler(args) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
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
    return { notification: notification };
  } catch (err) {
    console.error('Failed to create notification:', err);
    return { error: 'Internal Server Error' };
  }
}
/**
 * List notifications with pagination and optional type filter.
 * Ordered by newest first.
 */
export async function listNotificationsHandler(args) {
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
      .select({ count: sql`count(*)::int` })
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
      items: items,
      total: Number(count),
    };
  } catch (err) {
    console.error('Failed to list notifications:', err);
    return { error: 'Internal Server Error' };
  }
}
// --- Phase 1: New handler implementations ---
/**
 * Mark a single notification as read.
 * Validates ownership — only the notification owner can mark it as read.
 */
export async function markReadHandler(args) {
  const session = await getSessionFromHeaders();
  if (!isAuthenticated(session)) {
    return { error: 'Unauthorized' };
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
      return { error: 'Notification not found' };
    }
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));
    return { success: true };
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
    return { error: 'Internal Server Error' };
  }
}
/**
 * Mark all unread notifications as read for the current user.
 */
export async function markAllReadHandler(_args) {
  const session = await getSessionFromHeaders();
  if (!isAuthenticated(session)) {
    return { error: 'Unauthorized' };
  }
  const db = getDb();
  try {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)));
    return { success: true };
  } catch (err) {
    console.error('Failed to mark all notifications as read:', err);
    return { error: 'Internal Server Error' };
  }
}
/**
 * Get the count of unread notifications for the current user.
 */
export async function getUnreadCountHandler(_args) {
  const session = await getSessionFromHeaders();
  if (!isAuthenticated(session)) {
    return { error: 'Unauthorized' };
  }
  const db = getDb();
  try {
    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)));
    return { count: Number(count) };
  } catch (err) {
    console.error('Failed to get unread count:', err);
    return { error: 'Internal Server Error' };
  }
}
