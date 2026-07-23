/**
 * Pure function: checks whether an in-app notification should be created
 * for the given notification type, based on user settings.
 *
 * Absent key = enabled (returns true). Only returns false when `inApp` is
 * explicitly set to `false` for the given type.
 */
export function shouldSendInAppNotification(settings: unknown, type: string): boolean {
  if (!settings || typeof settings !== 'object') return true;

  const prefs = (settings as { notificationPrefs?: Record<string, { inApp?: boolean }> })
    ?.notificationPrefs;
  if (!prefs) return true;

  const typePref = prefs[type];
  if (!typePref) return true;

  return typePref.inApp !== false;
}
