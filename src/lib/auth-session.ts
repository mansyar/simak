import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { session } from '../db/schema/index';
import { logAuditEvent } from './audit';

/**
 * Revokes all active sessions for a user and logs the event.
 */
export async function revokeUserSessions(userId: string, actorId: string = userId): Promise<void> {
  const db = getDb();

  await db.delete(session).where(eq(session.userId, userId));

  await logAuditEvent({
    actorId,
    action: 'session.revoked',
    entityType: 'user',
    entityId: userId,
  });
}
