// Server-only helpers (not imported by client code)
import { eq } from 'drizzle-orm';
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

const BULK_TEMPLATE_ROW_LIMIT = 500;

export async function bulkCreateTemplatesHandler(args: { data: BulkCreateTemplatesInput }) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { error: 'Unauthorized' };
  }

  const { rows } = args.data;

  // Row-limit guard (checkpoint rows)
  if (rows.length > BULK_TEMPLATE_ROW_LIMIT) {
    return {
      created: 0,
      skipped: 1,
      errors: [
        {
          templateName: '',
          reason: `Exceeds maximum of ${BULK_TEMPLATE_ROW_LIMIT} checkpoint rows per import`,
        },
      ],
    };
  }

  // Group rows by templateName
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const existing = groups.get(row.templateName);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(row.templateName, [row]);
    }
  }

  const db = getDb();
  let createdCount = 0;
  let skippedCount = 0;
  const errors: { templateName: string; reason: string }[] = [];

  for (const [templateName, groupRows] of groups) {
    // Validate group: consistent type
    const types = new Set(groupRows.map((r) => r.type));
    if (types.size > 1) {
      errors.push({ templateName, reason: 'Inconsistent type across rows' });
      skippedCount++;
      continue;
    }

    // Validate group: all checkpoint names non-empty
    const hasEmptyCheckpoint = groupRows.some(
      (r) => !r.checkpointName || r.checkpointName.trim() === '',
    );
    if (hasEmptyCheckpoint) {
      errors.push({ templateName, reason: 'Checkpoint name cannot be empty' });
      skippedCount++;
      continue;
    }

    // Validate group: at least one checkpoint
    if (groupRows.length < 1) {
      errors.push({ templateName, reason: 'Template must have at least one checkpoint' });
      skippedCount++;
      continue;
    }

    const type = groupRows[0].type;

    // Create template + checkpoints in a transaction pattern
    try {
      const [inserted] = await db
        .insert(assignmentTemplates)
        .values({
          name: templateName,
          type,
          createdBy: session.user.id,
        })
        .returning({ id: assignmentTemplates.id })
        .then((rows) => rows);

      const checkpointRows = groupRows.map((cp, index) => ({
        templateId: inserted.id,
        name: cp.checkpointName,
        order: index + 1,
        minConsultations: cp.minConsultations ?? 0,
        estimatedDuration: cp.estimatedDuration ?? 7,
      }));

      await db.insert(templateCheckpoints).values(checkpointRows);

      createdCount++;
    } catch {
      errors.push({ templateName, reason: 'Failed to create template' });
      skippedCount++;
    }
  }

  // Audit log
  if (createdCount > 0) {
    await logAuditEvent({
      actorId: session.user.id,
      action: 'template.bulk_created',
      entityType: 'template',
      entityId: session.user.id,
      details: {
        created: createdCount,
        skipped: skippedCount,
        errors: errors.length,
      },
    });
  }

  return { created: createdCount, skipped: skippedCount, errors };
}
