import { getDb } from '@/db/index';
import { auditLog } from '@/db/schema/audit-log';
import { logger } from '@/lib/logger';

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

/**
 * Wraps logAuditEvent in a try/catch so advisory audit failures
 * do not fail the request (SQL styleguide §6.4 — post-commit advisory work).
 */
export async function safeAuditLog(label: string, event: Parameters<typeof logAuditEvent>[0]) {
  try {
    await logAuditEvent(event);
  } catch (e) {
    logger.error({
      event: 'advisory_failed',
      handler: 'safeAuditLog',
      label,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
