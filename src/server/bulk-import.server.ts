// Server-only helpers (not imported by client code)
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'node:crypto';
import { getDb } from '../db/index';
import { users, verification, assignmentTemplates, templateCheckpoints } from '../db/schema/index';
import { sendInvitationEmail } from '../lib/email';
import { logAuditEvent } from '../lib/audit';
import { getSessionFromHeaders } from './auth';
import type { z } from 'zod';
import type { BulkCreateUsersSchema, BulkCreateTemplatesSchema } from './bulk-import';

type BulkCreateUsersInput = z.infer<typeof BulkCreateUsersSchema>;
type BulkCreateTemplatesInput = z.infer<typeof BulkCreateTemplatesSchema>;

const BULK_USER_ROW_LIMIT = 500;

const CREATION_ALLOWED_ROLES: Record<string, readonly string[]> = {
  superadmin: ['admin', 'instructor', 'student'],
  admin: ['instructor', 'student'],
};

export async function bulkCreateUsersHandler(args: { data: BulkCreateUsersInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const allowedRoles = CREATION_ALLOWED_ROLES[session.user.role];
  if (!allowedRoles) {
    return { error: 'Unauthorized' };
  }

  const { rows } = args.data;

  // Row-limit guard
  if (rows.length > BULK_USER_ROW_LIMIT) {
    return {
      created: 0,
      skipped: rows.length,
      errors: [
        { row: 1, email: '', reason: `Exceeds maximum of ${BULK_USER_ROW_LIMIT} rows per import` },
      ],
    };
  }

  const db = getDb();
  const created: number[] = [];
  const skipped: number[] = [];
  const errors: { row: number; email: string; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 1;

    // Role-permission check
    if (!allowedRoles.includes(row.role)) {
      if (session.user.role === 'admin' && row.role === 'admin') {
        errors.push({
          row: rowIndex,
          email: row.email,
          reason: 'Admins cannot create other Admin accounts',
        });
      } else {
        errors.push({ row: rowIndex, email: row.email, reason: 'Invalid role' });
      }
      skipped.push(rowIndex);
      continue;
    }

    // Email uniqueness check (including soft-deleted)
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, row.email))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingUser) {
      errors.push({ row: rowIndex, email: row.email, reason: 'Email already in use' });
      skipped.push(rowIndex);
      continue;
    }

    // Create user
    const userId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(users).values({
      id: userId,
      name: row.name,
      email: row.email,
      role: row.role as 'admin' | 'instructor' | 'student',
      locale: session.user.locale || 'en',
    });

    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: row.email,
      value: token,
      expiresAt,
    });

    created.push(rowIndex);

    // Enqueue invitation email (non-blocking)
    try {
      await sendInvitationEmail({
        email: row.email,
        name: row.name,
        token,
      });
    } catch {
      // Email failure is non-fatal as per spec
    }
  }

  // Audit log
  if (created.length > 0) {
    await logAuditEvent({
      actorId: session.user.id,
      action: 'user.bulk_created',
      entityType: 'user',
      entityId: session.user.id,
      details: {
        created: created.length,
        skipped: skipped.length,
        errors: errors.length,
      },
    });
  }

  return { created: created.length, skipped: skipped.length, errors };
}

export async function bulkCreateTemplatesHandler(args: { data: BulkCreateTemplatesInput }) {
  // Placeholder implementation
  return { created: 0, skipped: 0, errors: [] };
}
