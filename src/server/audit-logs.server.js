// Server-only handlers for audit log queries
import { getSessionFromHeaders } from './auth';
import { getDb } from '@/db/index';
import { auditLog } from '@/db/schema/audit-log';
import { count, desc, sql, and, gte, lte, or, like } from 'drizzle-orm';
const ADMIN_ROLES = ['superadmin', 'admin'];
function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}
export async function listAuditLogsHandler(input) {
  const session = await getSessionFromHeaders();
  if (!session || !isAdminRole(session.user.role)) {
    throw new Error('Forbidden: Admin role required');
  }
  const db = getDb();
  const { page, limit, action, dateFrom, dateTo, search } = input.data;
  const offset = (page - 1) * limit;
  // Build dynamic where conditions
  const conditions = [];
  if (action) {
    conditions.push(sql`${auditLog.action} = ${action}`);
  }
  if (dateFrom) {
    conditions.push(gte(auditLog.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(auditLog.createdAt, new Date(dateTo)));
  }
  if (search) {
    conditions.push(
      or(
        like(auditLog.details, sql`'%' || ${search} || '%'`),
        like(auditLog.entityId, `%${search}%`),
      ),
    );
  }
  // Get total count
  const countQuery = db.select({ total: count() }).from(auditLog);
  const dataQuery = db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);
  if (conditions.length > 0) {
    const combined = and(...conditions);
    countQuery.where(combined);
    dataQuery.where(combined);
  }
  const [countResult, entries] = await Promise.all([countQuery, dataQuery]);
  const total = Number(countResult[0]?.total ?? 0);
  // Cast entries to a serializable format for TanStack Start
  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details,
      createdAt: entry.createdAt?.toISOString() ?? null,
    })),
    total,
    page,
    limit,
  };
}
export async function getAuditLogDetailHandler(input) {
  const session = await getSessionFromHeaders();
  if (!session || !isAdminRole(session.user.role)) {
    throw new Error('Forbidden: Admin role required');
  }
  const db = getDb();
  const { id } = input.data;
  const result = await db
    .select()
    .from(auditLog)
    .where(sql`${auditLog.id} = ${id}`)
    .limit(1);
  if (!result[0]) {
    throw new Error('Audit log entry not found');
  }
  const entry = result[0];
  return {
    id: entry.id,
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    details: entry.details,
    createdAt: entry.createdAt?.toISOString() ?? null,
  };
}
