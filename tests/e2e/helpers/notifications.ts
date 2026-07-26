import postgres from 'postgres';
import { getDatabaseUrl } from './db-reset';

/**
 * Delete all notifications from the test database.
 * Used for test isolation before notification assertion tests.
 */
export async function cleanupNotifications(): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  await sql`DELETE FROM notifications`;
  await sql.end();
}

/**
 * Insert a notification record directly into the DB for a given user.
 * Used to simulate server-side notification creation in E2E tests
 * (since R2 upload cannot be fully tested via UI).
 */
export async function createNotification(
  userEmail: string,
  type: string,
  params: Record<string, string> = {},
): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  const titleKey = `notifications.events.${type}.title`;
  const messageKey = `notifications.events.${type}.message`;
  await sql`
    INSERT INTO notifications (user_id, type, title_key, message_key, params, channel, read)
    VALUES (
      (SELECT id FROM users WHERE email = ${userEmail}),
      ${type},
      ${titleKey},
      ${messageKey},
      ${JSON.stringify(params)}::jsonb,
      'in_app',
      false
    )
  `;
  await sql.end();
}
