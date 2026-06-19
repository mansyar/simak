// Server-only handler for review-queue assignment filter
import { and, eq, isNull, desc } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments } from '../db/schema/assignments';
import { getSessionFromHeaders } from './auth';
function isInstructor(session) {
  return !!session && session.user.role === 'instructor';
}
export async function listInstructorAssignmentsForFilterHandler() {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return { error: 'Unauthorized' };
  }
  const db = getDb();
  const results = await db
    .select({ id: assignments.id, title: assignments.title })
    .from(assignments)
    .where(and(eq(assignments.instructorId, session.user.id), isNull(assignments.deletedAt)))
    .orderBy(desc(assignments.createdAt));
  return { success: true, assignments: results };
}
