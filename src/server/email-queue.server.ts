// Server-only handlers (not imported by client code)
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { emailQueue } from '../db/schema/email-queue';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode, type ServerError } from '../lib/errors';
import type {
  ListEmailQueueInput,
  RetryEmailInput,
  EmailQueueEntry,
  EmailQueueSummary,
} from './email-queue';

// Re-export shared types for callers that historically imported them from here
export type { EmailQueueEntry, EmailQueueSummary } from './email-queue';

// ---- Types ----

export type ListEmailQueueSuccess = {
  entries: EmailQueueEntry[];
  total: number;
  page: number;
  limit: number;
};

export type RetryEmailSuccess = {
  success: true;
  emailId: number;
};

// ---- Admin Role Check ----

const ADMIN_ROLES = ['superadmin', 'admin'] as const;

function isAdminRole(role: string): role is (typeof ADMIN_ROLES)[number] {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

// ---- listEmailQueueHandler ----

export async function listEmailQueueHandler(args: {
  data: ListEmailQueueInput;
}): Promise<ListEmailQueueSuccess | ServerError> {
  const session = await getSessionFromHeaders();
  if (!session || !isAdminRole(session.user.role)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { page, status, search } = args.data;
  const db = getDb();
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    // Build filter conditions
    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(emailQueue.status, status));
    }
    if (search) {
      const searchCondition = or(
        ilike(emailQueue.recipientEmail, `%${search}%`),
        ilike(emailQueue.subject, `%${search}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const combined = conditions.length > 0 ? and(...conditions) : undefined;

    // Data query (excludes bodyHtml)
    const dataQuery = db
      .select({
        id: emailQueue.id,
        recipientEmail: emailQueue.recipientEmail,
        subject: emailQueue.subject,
        templateType: emailQueue.templateType,
        status: emailQueue.status,
        attempts: emailQueue.attempts,
        lastAttemptAt: emailQueue.lastAttemptAt,
        errorMessage: emailQueue.errorMessage,
        resendMessageId: emailQueue.resendMessageId,
        createdAt: emailQueue.createdAt,
      })
      .from(emailQueue)
      .where(combined)
      .orderBy(desc(emailQueue.createdAt))
      .limit(limit)
      .offset(offset);

    // Count query (filtered — for pagination total)
    const countQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(emailQueue)
      .where(combined);

    const [countResult, entries] = await Promise.all([countQuery, dataQuery]);

    return {
      entries: entries.map((e) => ({
        id: e.id,
        recipientEmail: e.recipientEmail,
        subject: e.subject,
        templateType: e.templateType,
        status: e.status,
        attempts: e.attempts ?? 0,
        lastAttemptAt: e.lastAttemptAt ? new Date(e.lastAttemptAt).toISOString() : null,
        errorMessage: e.errorMessage,
        resendMessageId: e.resendMessageId,
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null,
      })),
      total: countResult[0]?.total ?? 0,
      page,
      limit,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listEmailQueueHandler',
    });
  }
}

export async function getEmailQueueSummaryHandler(): Promise<EmailQueueSummary | ServerError> {
  const session = await getSessionFromHeaders();
  if (!session || !isAdminRole(session.user.role)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  try {
    const [summary] = await db
      .select({
        pending: sql<number>`count(*) filter (where ${emailQueue.status} = 'pending')::int`,
        sent: sql<number>`count(*) filter (where ${emailQueue.status} = 'sent')::int`,
        failed: sql<number>`count(*) filter (where ${emailQueue.status} = 'failed')::int`,
      })
      .from(emailQueue);

    return {
      pending: Number(summary?.pending ?? 0),
      sent: Number(summary?.sent ?? 0),
      failed: Number(summary?.failed ?? 0),
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getEmailQueueSummaryHandler',
    });
  }
}

// ---- retryEmailHandler ----

export async function retryEmailHandler(args: {
  data: RetryEmailInput;
}): Promise<RetryEmailSuccess | ServerError> {
  const session = await getSessionFromHeaders();
  if (!session || !isAdminRole(session.user.role)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  const { emailId } = args.data;

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(emailQueue)
        .where(eq(emailQueue.id, emailId))
        .for('update', { of: emailQueue });

      if (!row) {
        return { kind: 'not_found' as const };
      }

      if (row.status !== 'failed') {
        return { kind: 'conflict' as const, currentStatus: row.status as string };
      }

      await tx
        .update(emailQueue)
        .set({
          status: 'pending',
          attempts: 0,
          errorMessage: null,
          lastAttemptAt: null,
        })
        .where(eq(emailQueue.id, emailId));

      return { kind: 'ok' as const };
    });

    if (result.kind === 'not_found') {
      return serverError(ErrorCode.NOT_FOUND, 'Email not found');
    }

    if (result.kind === 'conflict') {
      return serverError(
        ErrorCode.CONFLICT,
        `Email is not in failed state (current: ${result.currentStatus})`,
      );
    }

    return { success: true, emailId };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'retryEmailHandler',
    });
  }
}
