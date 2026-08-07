// Server-only handler for review-queue assignment filter
import { and, eq, isNull, desc } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments } from '../db/schema/assignments';
import { courseSections, sectionEnrollments } from '../db/schema/academic-context';
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
      .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
      .innerJoin(
        sectionEnrollments,
        and(
          eq(sectionEnrollments.sectionId, assignments.sectionId),
          eq(sectionEnrollments.userId, session.user.id),
          eq(sectionEnrollments.role, 'instructor'),
          eq(sectionEnrollments.isActive, true),
        ),
      )
      .where(
        and(
          eq(assignments.instructorId, session.user.id),
          eq(courseSections.status, 'active'),
          eq(assignments.status, 'active'),
          isNull(assignments.deletedAt),
        ),
      )
      .orderBy(desc(assignments.createdAt));

    return { success: true, assignments: results };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listInstructorAssignmentsForFilterHandler',
    });
  }
}
