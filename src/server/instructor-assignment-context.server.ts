import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { academicTerms, courseSections, courses, sectionEnrollments, users } from '@/db/schema';
import { serverError } from '@/lib/errors';
import { getSessionFromHeaders } from './auth';

export async function listInstructorAssignmentSectionsHandler() {
  const session = await getSessionFromHeaders();

  if (!session) return serverError('UNAUTHORIZED', 'Authentication required');
  if (session.user.role !== 'instructor') {
    return serverError('FORBIDDEN', 'Instructor access required');
  }

  try {
    const db = getDb();
    const sectionRows = await db
      .select({
        id: courseSections.id,
        code: courseSections.code,
        name: courseSections.name,
        status: courseSections.status,
        termId: academicTerms.id,
        termName: academicTerms.name,
        courseId: courses.id,
        courseCode: courses.code,
      })
      .from(courseSections)
      .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
      .innerJoin(courses, eq(courseSections.courseId, courses.id))
      .innerJoin(
        sectionEnrollments,
        and(
          eq(sectionEnrollments.sectionId, courseSections.id),
          eq(sectionEnrollments.userId, session.user.id),
          eq(sectionEnrollments.role, 'instructor'),
          eq(sectionEnrollments.isActive, true),
        ),
      )
      .where(eq(courseSections.status, 'active'))
      .orderBy(asc(academicTerms.startDate), asc(courses.code), asc(courseSections.code));

    const sections = await Promise.all(
      sectionRows.map(async (section) => {
        const studentRows = await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(sectionEnrollments)
          .innerJoin(users, eq(sectionEnrollments.userId, users.id))
          .where(
            and(
              eq(sectionEnrollments.sectionId, section.id),
              eq(sectionEnrollments.role, 'student'),
              eq(sectionEnrollments.isActive, true),
              isNull(users.deletedAt),
            ),
          )
          .orderBy(asc(users.name), asc(users.email));

        return {
          id: section.id,
          label: `${section.courseCode} · ${section.code} · ${section.termName}`,
          termId: section.termId,
          courseId: section.courseId,
          status: section.status,
          students: studentRows,
        };
      }),
    );

    return { sections };
  } catch (error) {
    console.error('Failed to load instructor assignment sections', error);
    return serverError('INTERNAL', 'Unable to load course sections');
  }
}
