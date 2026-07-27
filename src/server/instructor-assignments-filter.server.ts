// Server-only handler for review-queue assignment filter
import { and, eq, isNull, desc } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments } from '../db/schema/assignments';
import { getSessionFromHeaders } from './auth';
import { isInstructor } from '../lib/session-guards';
import { serverError, ErrorCode } from '../lib/errors';

export async function listInstructorAssignmentsForFilterHandler() {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();

  try {
    const results = await db
      .select({ id: assignments.id, title: assignments.title })
      .from(assignments)
      .where(and(eq(assignments.instructorId, session.user.id), isNull(assignments.deletedAt)))
      .orderBy(desc(assignments.createdAt));

    return { success: true, assignments: results };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listInstructorAssignmentsForFilterHandler',
    });
  }
}
