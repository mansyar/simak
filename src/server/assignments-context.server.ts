import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../db/index';
import {
  academicTerms,
  courseSections,
  courses,
  sectionEnrollments,
} from '../db/schema/academic-context';
import { users } from '../db/schema/users';

export type AssignmentContextRow = {
  termId: number;
  termCode: string;
  termName: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  sectionId: number;
  sectionCode: string;
  sectionName: string | null;
};

export type AssignmentContextProjection = {
  term: { id: number; code: string; name: string };
  course: { id: number; code: string; name: string };
  section: { id: number; code: string; name: string | null };
};

export async function getAuthorizedInstructorSection(
  db: Db,
  sectionId: number,
  instructorId: string,
) {
  const [section] = await db
    .select({ sectionId: courseSections.id })
    .from(courseSections)
    .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
    .innerJoin(
      sectionEnrollments,
      and(
        eq(sectionEnrollments.sectionId, courseSections.id),
        eq(sectionEnrollments.userId, instructorId),
        eq(sectionEnrollments.role, 'instructor'),
        eq(sectionEnrollments.isActive, true),
      ),
    )
    .where(
      and(
        eq(courseSections.id, sectionId),
        eq(courseSections.status, 'active'),
        eq(academicTerms.status, 'active'),
      ),
    )
    .limit(1);

  return section ?? null;
}

export async function getActiveSectionStudentIds(db: Db, sectionId: number, studentIds: string[]) {
  return db
    .select({ id: users.id })
    .from(sectionEnrollments)
    .innerJoin(users, eq(sectionEnrollments.userId, users.id))
    .where(
      and(
        eq(sectionEnrollments.sectionId, sectionId),
        eq(sectionEnrollments.role, 'student'),
        eq(sectionEnrollments.isActive, true),
        inArray(sectionEnrollments.userId, studentIds),
        eq(users.role, 'student'),
        isNull(users.deletedAt),
      ),
    );
}

export async function getAssignmentContext(db: Db, sectionId: number) {
  const [context] = await db
    .select({
      termId: academicTerms.id,
      termCode: academicTerms.code,
      termName: academicTerms.name,
      courseId: courses.id,
      courseCode: courses.code,
      courseName: courses.name,
      sectionId: courseSections.id,
      sectionCode: courseSections.code,
      sectionName: courseSections.name,
    })
    .from(courseSections)
    .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
    .innerJoin(courses, eq(courseSections.courseId, courses.id))
    .where(eq(courseSections.id, sectionId))
    .limit(1);

  return context ?? null;
}

export function toAssignmentContextProjection(
  context: AssignmentContextRow,
): AssignmentContextProjection {
  return {
    term: { id: context.termId, code: context.termCode, name: context.termName },
    course: { id: context.courseId, code: context.courseCode, name: context.courseName },
    section: { id: context.sectionId, code: context.sectionCode, name: context.sectionName },
  };
}
