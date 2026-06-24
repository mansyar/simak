// Server-only handlers for session management (not imported by client code)
import { eq, and, ne, gt } from 'drizzle-orm';
import { getDb } from '../db/index';
import { session as sessionTable } from '../db/schema/index';
import { logAuditEvent } from '../lib/audit';
import { getSessionFromHeaders } from './auth';
import type { z } from 'zod';
import type { RevokeSessionSchema } from './sessions';

type RevokeSessionInput = z.infer<typeof RevokeSessionSchema>;

function parseUserAgent(ua: string | null): {
  browser: string;
  os: string;
  device: string;
} {
  if (!ua) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  }

  let browser = 'Unknown';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'Unknown';
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  let device = 'Desktop';
  if (ua.includes('Mobile') || ua.includes('Android')) device = 'Mobile';
  else if (ua.includes('iPad')) device = 'Tablet';

  return { browser, os, device };
}

export async function listActiveSessionsHandler() {
  const session_ = await getSessionFromHeaders();
  if (!session_) {
    return { error: 'Unauthorized' };
  }

  const db = getDb();
  const now = new Date();
  const sessions = await db
    .select()
    .from(sessionTable)
    .where(and(eq(sessionTable.userId, session_.user.id), gt(sessionTable.expiresAt, now)))
    .orderBy(sessionTable.createdAt);

  const enriched = sessions.map((s) => ({
    id: s.id,
    isCurrent: s.id === session_.session.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    device: parseUserAgent(s.userAgent),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  return { sessions: enriched, total: enriched.length };
}

export async function revokeSessionHandler(args: { data: RevokeSessionInput }) {
  const session_ = await getSessionFromHeaders();
  if (!session_) {
    return { error: 'Unauthorized' };
  }

  if (args.data.sessionId === session_.session.id) {
    return { error: 'Cannot revoke current session' };
  }

  try {
    const db = getDb();
    await db
      .delete(sessionTable)
      .where(
        and(eq(sessionTable.id, args.data.sessionId), eq(sessionTable.userId, session_.user.id)),
      );

    await logAuditEvent({
      actorId: session_.user.id,
      action: 'session.revoked',
      entityType: 'session',
      entityId: args.data.sessionId,
    });

    return { success: true };
  } catch {
    return { error: 'Failed to revoke session' };
  }
}

export async function revokeAllOtherSessionsHandler() {
  const session_ = await getSessionFromHeaders();
  if (!session_) {
    return { error: 'Unauthorized' };
  }

  try {
    const db = getDb();
    const result = await db
      .delete(sessionTable)
      .where(
        and(eq(sessionTable.userId, session_.user.id), ne(sessionTable.id, session_.session.id)),
      );

    const revokedCount = (result as { rowCount?: number })?.rowCount ?? 0;

    await logAuditEvent({
      actorId: session_.user.id,
      action: 'session.all_others_revoked',
      entityType: 'session',
      entityId: session_.user.id,
      details: { revokedCount },
    });

    return { success: true, revokedCount };
  } catch {
    return { error: 'Failed to revoke sessions' };
  }
}
