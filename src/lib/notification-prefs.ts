import { eq } from 'drizzle-orm';
import { users } from '../db/schema/users';
import { notifications } from '../db/schema/notifications';
import type { Db } from '../db/index';

type NotificationInsert = typeof notifications.$inferInsert;
type NotificationPrefs = Record<string, { inApp?: boolean }>;

function hasNotificationPrefs(s: unknown): s is { notificationPrefs?: NotificationPrefs } {
  return typeof s === 'object' && s !== null && 'notificationPrefs' in s;
}

/**
 * Checks whether an in-app notification should be created for the given
 * notification type, based on user settings. Absent key = enabled (returns
 * true). Only returns false when `inApp` is explicitly `false` for the type.
 */
export function shouldSendInAppNotification(settings: unknown, type: string): boolean {
  if (!hasNotificationPrefs(settings)) return true;

  const prefs = settings.notificationPrefs;
  if (!prefs) return true;

  const typePref = prefs[type];
  if (!typePref) return true;

  return typePref.inApp !== false;
}

/**
 * Fetches recipient settings, checks the in-app preference, and inserts the
 * notification only if enabled. Combines shouldSendInAppNotification with the
 * settings SELECT and conditional INSERT for single-notification sites.
 */
export async function maybeInsertNotification(
  db: Db,
  userId: string,
  type: string,
  values: NotificationInsert,
): Promise<void> {
  const [row] = await db
    .select({ settings: users.settings })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (shouldSendInAppNotification(row?.settings, type)) {
    await db.insert(notifications).values(values);
  }
}
