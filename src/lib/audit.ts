import { getDb } from '@/db/index';
import { auditLog } from '@/db/schema/audit-log';

/**
 * Logs an audit event to the audit_log table.
 * Used across all handlers to record meaningful actions.
 */
export async function logAuditEvent(event: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  if (!event.actorId) {
    throw new Error('actorId is required');
  }

  const db = getDb();
  await db.insert(auditLog).values({
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    details: event.details ?? null,
  });
}
