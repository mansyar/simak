// Server-only handlers for audit log queries
import { getSessionFromHeaders } from './auth';
import { getDb } from '@/db/index';
import { auditLog } from '@/db/schema/audit-log';
import { users } from '@/db/schema/users';
import { count, desc, sql, and, gte, lte, or, like, type SQL } from 'drizzle-orm';

const ADMIN_ROLES = ['superadmin', 'admin'] as const;

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

interface ListAuditLogsInput {
  data: {
    page: number;
    limit: number;
    action: string;
    dateFrom: string;
    dateTo: string;
    search: string;
  };
}

interface GetAuditLogDetailInput {
  data: {
    id: number;
  };
}

export async function listAuditLogsHandler(input: ListAuditLogsInput) {
  const session = await getSessionFromHeaders();
  if (!session || !isAdminRole(session.user.role)) {
    throw new Error('Forbidden: Admin role required');
  }

  const db = getDb();
  const { page, limit, action, dateFrom, dateTo, search } = input.data;
  const offset = (page - 1) * limit;

  // Build dynamic where conditions
  const conditions: SQL[] = [];

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
      )!,
    );
  }

  // Get total count
  const countQuery = db.select({ total: count() }).from(auditLog);
  const dataQuery = db
    .select({
      id: auditLog.id,
      actorId: auditLog.actorId,
      actorName: users.name,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      details: auditLog.details,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, sql`${auditLog.actorId} = ${users.id}`)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    const combined = and(...conditions)!;
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
      actorName: entry.actorName ?? entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details as Record<string, string | number | boolean | null> | null,
      createdAt: entry.createdAt?.toISOString() ?? null,
    })),
    total,
    page,
    limit,
  };
}

export async function getAuditLogDetailHandler(input: GetAuditLogDetailInput) {
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
    details: entry.details as Record<string, string | number | boolean | null> | null,
    createdAt: entry.createdAt?.toISOString() ?? null,
  };
}
