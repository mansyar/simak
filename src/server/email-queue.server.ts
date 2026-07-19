// Server-only handlers (not imported by client code)
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { emailQueue } from '../db/schema/email-queue';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode, type ServerError } from '../lib/errors';
import type { ListEmailQueueInput, RetryEmailInput } from './email-queue';

// ---- Types ----

export type EmailQueueEntry = {
  id: number;
  recipientEmail: string;
  subject: string;
  templateType: string;
  status: string;
  attempts: number;
  lastAttemptAt: string | null;
  errorMessage: string | null;
  createdAt: string | null;
};

export type EmailQueueSummary = {
  pending: number;
  sent: number;
  failed: number;
};

export type ListEmailQueueSuccess = {
  entries: EmailQueueEntry[];
  total: number;
  page: number;
  limit: number;
  summary: EmailQueueSummary;
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
      conditions.push(
        or(
          ilike(emailQueue.recipientEmail, `%${search}%`),
          ilike(emailQueue.subject, `%${search}%`),
        )!,
      );
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

    // Summary query (NOT filtered — overall queue counts)
    const summaryQuery = db
      .select({
        pending: sql<number>`count(*) filter (where ${emailQueue.status} = 'pending')::int`,
        sent: sql<number>`count(*) filter (where ${emailQueue.status} = 'sent')::int`,
        failed: sql<number>`count(*) filter (where ${emailQueue.status} = 'failed')::int`,
      })
      .from(emailQueue);

    const [countResult, entries, summaryResult] = await Promise.all([
      countQuery,
      dataQuery,
      summaryQuery,
    ]);

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
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null,
      })),
      total: countResult[0]?.total ?? 0,
      page,
      limit,
      summary: {
        pending: Number(summaryResult[0]?.pending ?? 0),
        sent: Number(summaryResult[0]?.sent ?? 0),
        failed: Number(summaryResult[0]?.failed ?? 0),
      },
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listEmailQueueHandler',
    });
  }
}

// ---- retryEmailHandler (stub — will be implemented in Task 3) ----

export async function retryEmailHandler(_args: {
  data: RetryEmailInput;
}): Promise<RetryEmailSuccess | ServerError> {
  const session = await getSessionFromHeaders();
  if (!session || !isAdminRole(session.user.role)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  // TODO: implement retry logic in Task 3
  return serverError(ErrorCode.INTERNAL, 'Not implemented');
}
