// Server-only handlers (not imported by client code)
import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { feedbackSnippets } from '@/db/schema/feedback-snippets';
import { serverError, ErrorCode } from '@/lib/errors';
import { getSessionFromHeaders } from './auth';
import type { z } from 'zod';
import type {
  ArchiveFeedbackSnippetSchema,
  CreateFeedbackSnippetSchema,
  FeedbackSnippetIdSchema,
  RestoreFeedbackSnippetSchema,
  UpdateFeedbackSnippetSchema,
} from './feedback-snippets';

type ListFeedbackSnippetsInput = {
  archived?: boolean;
  search?: string;
  page?: number;
  limit?: number;
};
type CreateFeedbackSnippetInput = z.infer<typeof CreateFeedbackSnippetSchema>;
type UpdateFeedbackSnippetInput = z.infer<typeof UpdateFeedbackSnippetSchema>;
type FeedbackSnippetIdInput = z.infer<typeof FeedbackSnippetIdSchema>;

const snippetSelection = {
  id: feedbackSnippets.id,
  title: feedbackSnippets.title,
  category: feedbackSnippets.category,
  body: feedbackSnippets.body,
  archivedAt: feedbackSnippets.archivedAt,
  createdAt: feedbackSnippets.createdAt,
  updatedAt: feedbackSnippets.updatedAt,
};

const snippetListSelection = {
  id: feedbackSnippets.id,
  title: feedbackSnippets.title,
  category: feedbackSnippets.category,
  body: feedbackSnippets.body,
  archivedAt: feedbackSnippets.archivedAt,
};

function normalizeContent(data: CreateFeedbackSnippetInput) {
  return {
    title: data.title.trim(),
    category: data.category?.trim() || null,
    body: data.body.trim(),
  };
}

function notFound() {
  return serverError(ErrorCode.NOT_FOUND, 'Feedback snippet not found');
}

export async function listFeedbackSnippetsHandler({ data }: { data: ListFeedbackSnippetsInput }) {
  const session = await getSessionFromHeaders();
  if (!session || session.user.role !== 'instructor') {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  try {
    const archived = data.archived ?? false;
    const search = (data.search ?? '').trim();
    const page = data.page ?? 1;
    const limit = Math.min(data.limit ?? 20, 50);
    const offset = (page - 1) * limit;
    const conditions = [
      eq(feedbackSnippets.instructorId, session.user.id),
      archived ? isNotNull(feedbackSnippets.archivedAt) : isNull(feedbackSnippets.archivedAt),
    ];
    if (search) {
      conditions.push(
        or(
          ilike(feedbackSnippets.title, `%${search}%`),
          ilike(feedbackSnippets.category, `%${search}%`),
        )!,
      );
    }

    const [snippets, countResult] = await Promise.all([
      db
        .select(snippetListSelection)
        .from(feedbackSnippets)
        .where(and(...conditions))
        .orderBy(desc(feedbackSnippets.updatedAt), desc(feedbackSnippets.id))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(feedbackSnippets)
        .where(and(...conditions)),
    ]);

    return { snippets, total: countResult[0]?.count ?? 0, page, limit };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listFeedbackSnippetsHandler',
      userId: session.user.id,
      input: data,
    });
  }
}

export async function createFeedbackSnippetHandler({ data }: { data: CreateFeedbackSnippetInput }) {
  const session = await getSessionFromHeaders();
  if (!session || session.user.role !== 'instructor') {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  try {
    const [snippet] = await db
      .insert(feedbackSnippets)
      .values({ instructorId: session.user.id, ...normalizeContent(data) })
      .returning(snippetSelection);

    return snippet ? { snippet } : notFound();
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'createFeedbackSnippetHandler',
      userId: session.user.id,
      input: data,
    });
  }
}

export async function updateFeedbackSnippetHandler({ data }: { data: UpdateFeedbackSnippetInput }) {
  const session = await getSessionFromHeaders();
  if (!session || session.user.role !== 'instructor') {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  try {
    const [snippet] = await db
      .update(feedbackSnippets)
      .set({ ...normalizeContent(data), updatedAt: new Date() })
      .where(
        and(eq(feedbackSnippets.id, data.id), eq(feedbackSnippets.instructorId, session.user.id)),
      )
      .returning(snippetSelection);

    return snippet ? { snippet } : notFound();
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'updateFeedbackSnippetHandler',
      userId: session.user.id,
      input: data,
    });
  }
}

async function setArchiveState(
  data: FeedbackSnippetIdInput,
  archivedAt: Date | null,
  handler: string,
) {
  const session = await getSessionFromHeaders();
  if (!session || session.user.role !== 'instructor') {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  try {
    const [snippet] = await db
      .update(feedbackSnippets)
      .set({ archivedAt, updatedAt: new Date() })
      .where(
        and(eq(feedbackSnippets.id, data.id), eq(feedbackSnippets.instructorId, session.user.id)),
      )
      .returning(snippetSelection);

    return snippet ? { snippet } : notFound();
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler,
      userId: session.user.id,
      input: data,
    });
  }
}

export async function archiveFeedbackSnippetHandler({
  data,
}: {
  data: z.infer<typeof ArchiveFeedbackSnippetSchema>;
}) {
  return setArchiveState(data, new Date(), 'archiveFeedbackSnippetHandler');
}

export async function restoreFeedbackSnippetHandler({
  data,
}: {
  data: z.infer<typeof RestoreFeedbackSnippetSchema>;
}) {
  return setArchiveState(data, null, 'restoreFeedbackSnippetHandler');
}
