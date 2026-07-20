// Server-only helpers (not imported by client code)
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { getDb } from '../db/index';
import {
  users,
  verification,
  assignmentTemplates,
  templateCheckpoints,
  auditLog,
} from '../db/schema/index';
import { sendInvitationEmail } from '../lib/email';
import { logAuditEvent } from '../lib/audit';
import { translateKey, resolveEmailSubject } from '../lib/i18n-server';
import { getSessionFromHeaders } from './auth';
import { CREATION_ALLOWED_ROLES } from '../lib/role-permissions';
import { serverError, ErrorCode } from '../lib/errors';
import type { z } from 'zod';
import type { BulkCreateUsersSchema, BulkCreateTemplatesSchema } from './bulk-import';

type BulkCreateUsersInput = z.infer<typeof BulkCreateUsersSchema>;
type BulkCreateTemplatesInput = z.infer<typeof BulkCreateTemplatesSchema>;

const BULK_USER_ROW_LIMIT = 500;

type RowResult = {
  rowIndex: number;
  email: string;
  status: 'created' | 'restored' | 'skipped';
  reason?: string;
};

const DUPLICATE_EMAIL_CODE = 'DUPLICATE_EMAIL';

export async function bulkCreateUsersHandler(args: { data: BulkCreateUsersInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const allowedRoles = CREATION_ALLOWED_ROLES[session.user.role];
  if (!allowedRoles) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { rows } = args.data;

  const locale = (session.user.locale || 'en') as 'en' | 'id';

  // Row-limit guard
  if (rows.length > BULK_USER_ROW_LIMIT) {
    const reason = resolveEmailSubject(
      'bulkImport.users.errors.rowLimit',
      { max: String(BULK_USER_ROW_LIMIT) },
      locale,
    );
    return {
      created: 0,
      skipped: rows.length,
      errors: [{ row: 1, email: '', reason: reason }],
      results: rows.map((row, index) => ({
        rowIndex: index + 1,
        email: row.email,
        status: 'skipped' as const,
        reason: reason,
      })),
    };
  }

  const db = getDb();
  const validRows: {
    rowIndex: number;
    name: string;
    email: string;
    role: string;
  }[] = [];
  const results: RowResult[] = [];
  const created: number[] = [];
  const skipped: number[] = [];
  const errors: { row: number; email: string; reason: string }[] = [];
  const stagedEmails = new Set<string>();
  // Advisory payloads collected during the transaction, dispatched post-commit (SQL styleguide §6.4)
  const emailPayloads: { email: string; name: string; token: string }[] = [];
  const perRowAudits: {
    action: 'user.created' | 'user.reactivated';
    userId: string;
    details: { email: string; role: string; status: 'created' | 'restored' };
  }[] = [];

  // Pre-filter rows by role before any DB writes
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 1;

    if (!allowedRoles.includes(row.role)) {
      const reasonKey =
        session.user.role === 'admin' && row.role === 'admin'
          ? 'bulkImport.users.errors.cannotCreateAdmin'
          : 'bulkImport.users.errors.invalidRole';
      const reason = translateKey(reasonKey, locale);
      errors.push({ row: rowIndex, email: row.email, reason });
      skipped.push(rowIndex);
      results.push({ rowIndex, email: row.email, status: 'skipped', reason });
      continue;
    }

    validRows.push({ rowIndex, name: row.name, email: row.email, role: row.role });
  }

  try {
    await db.transaction(async (outerTx) => {
      for (const candidate of validRows) {
        const { rowIndex, email, name, role } = candidate;

        if (stagedEmails.has(email)) {
          const reason = translateKey('bulkImport.users.errors.duplicateEmail', locale);
          errors.push({ row: rowIndex, email, reason });
          skipped.push(rowIndex);
          results.push({ rowIndex, email, status: 'skipped', reason });
          continue;
        }

        stagedEmails.add(email);

        let status: 'created' | 'restored' = 'created';
        let auditAction: 'user.created' | 'user.reactivated' = 'user.created';
        let userId = '';
        let token = '';

        try {
          await outerTx.transaction(async (tx) => {
            const existing = await tx
              .select({ id: users.id, deletedAt: users.deletedAt })
              .from(users)
              .where(eq(users.email, email))
              .limit(1)
              .then((rows) => rows[0]);

            if (existing) {
              if (existing.deletedAt != null) {
                userId = existing.id;
                status = 'restored';
                auditAction = 'user.reactivated';
                await tx
                  .update(users)
                  .set({
                    deletedAt: null,
                    name,
                    role: role as 'admin' | 'instructor' | 'student',
                    updatedAt: new Date(),
                  })
                  .where(eq(users.id, existing.id));
              } else {
                const duplicateErr = Object.assign(
                  new Error(translateKey('bulkImport.users.errors.duplicateEmail', locale)),
                  {
                    code: DUPLICATE_EMAIL_CODE,
                  },
                );
                throw duplicateErr;
              }
            } else {
              userId = crypto.randomUUID();
              status = 'created';
              auditAction = 'user.created';
              await tx.insert(users).values({
                id: userId,
                name,
                email,
                role: role as 'admin' | 'instructor' | 'student',
                locale: session.user.locale || 'en',
              });
            }

            token = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            await tx.insert(verification).values({
              id: crypto.randomUUID(),
              identifier: email,
              value: token,
              expiresAt,
            });
          });

          // Collect advisory payloads — dispatched post-commit (SQL styleguide §6.4)
          emailPayloads.push({ email, name, token });
          perRowAudits.push({
            action: auditAction,
            userId,
            details: { email, role, status },
          });

          created.push(rowIndex);
          results.push({ rowIndex, email, status });
        } catch (err) {
          const code = err && typeof err === 'object' ? (err as { code?: string }).code : undefined;
          if (code === '23505' || code === DUPLICATE_EMAIL_CODE) {
            const reason = translateKey('bulkImport.users.errors.duplicateEmail', locale);
            errors.push({ row: rowIndex, email, reason });
            skipped.push(rowIndex);
            results.push({ rowIndex, email, status: 'skipped', reason });
            continue;
          }
          // Non-23505 errors abort the whole batch per FR-H3.1
          throw err;
        }
      }
    });

    // Post-commit advisory work (SQL styleguide §6.4 — must run AFTER the transaction commits)
    // PERF-6: Parallelize invitation emails and batch per-row audit inserts
    if (emailPayloads.length > 0) {
      await Promise.allSettled(emailPayloads.map((payload) => sendInvitationEmail(payload)));
    }

    if (perRowAudits.length > 0) {
      try {
        await db.insert(auditLog).values(
          perRowAudits.map((audit) => ({
            actorId: session.user.id,
            action: audit.action,
            entityType: 'user',
            entityId: audit.userId,
            details: audit.details ?? null,
          })),
        );
      } catch (advisoryErr) {
        console.error('Per-row advisory audit log failed:', advisoryErr);
      }
    }

    if (created.length > 0) {
      try {
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
      } catch (advisoryErr) {
        console.error('Post-commit advisory work failed in bulkCreateUsersHandler:', advisoryErr);
      }
    }

    return { created: created.length, skipped: skipped.length, errors, results };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'bulkCreateUsersHandler',
    });
  }
}

const BULK_TEMPLATE_ROW_LIMIT = 500;

export async function bulkCreateTemplatesHandler(args: { data: BulkCreateTemplatesInput }) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
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

  try {
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

      // Create template + checkpoints in a single transaction (per-group atomicity)
      try {
        await db.transaction(async (tx) => {
          const [inserted] = await tx
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

          await tx.insert(templateCheckpoints).values(checkpointRows);
        });

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
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'bulkCreateTemplatesHandler',
    });
  }
}
