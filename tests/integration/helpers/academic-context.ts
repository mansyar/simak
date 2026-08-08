import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { academicTerms, courseSections, courses, sectionEnrollments } from '@/db/schema';

export type AcademicSectionFixture = {
  termId: number;
  courseId: number;
  sectionId: number;
};

export async function createAcademicSectionFixture(
  db: Db,
  suffix: string,
  instructorId: string,
  studentIds: string[],
): Promise<AcademicSectionFixture> {
  return db.transaction(async (tx) => {
    const [term] = await tx
      .insert(academicTerms)
      .values({
        code: `TEST-TERM-${suffix}`,
        name: `Test Term ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        status: 'active',
      })
      .returning({ id: academicTerms.id });

    const [course] = await tx
      .insert(courses)
      .values({
        code: `TEST-COURSE-${suffix}`,
        name: `Test Course ${suffix}`,
        credits: '3.00',
      })
      .returning({ id: courses.id });

    const [section] = await tx
      .insert(courseSections)
      .values({
        termId: term.id,
        courseId: course.id,
        code: 'A',
        name: `Test Section ${suffix}`,
      })
      .returning({ id: courseSections.id });

    await tx.insert(sectionEnrollments).values([
      { sectionId: section.id, userId: instructorId, role: 'instructor' },
      ...studentIds.map((userId) => ({
        sectionId: section.id,
        userId,
        role: 'student' as const,
      })),
    ]);

    return { termId: term.id, courseId: course.id, sectionId: section.id };
  });
}

export async function deleteAcademicSectionFixture(db: Db, fixture: AcademicSectionFixture) {
  await db.transaction(async (tx) => {
    await tx.delete(sectionEnrollments).where(eq(sectionEnrollments.sectionId, fixture.sectionId));
    await tx.delete(courseSections).where(eq(courseSections.id, fixture.sectionId));
    await tx.delete(courses).where(eq(courses.id, fixture.courseId));
    await tx.delete(academicTerms).where(eq(academicTerms.id, fixture.termId));
  });
}
