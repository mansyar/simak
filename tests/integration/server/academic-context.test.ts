/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import {
  academicTerms,
  auditLog,
  courseSections,
  courses,
  sectionEnrollments,
  users,
} from '@/db/schema';
import {
  addSectionEnrollmentHandler,
  createAcademicTermHandler,
  createCourseHandler,
  createCourseSectionHandler,
} from '@/server/academic-context.server';
import * as auth from '@/server/auth';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

describe('academic context administration integration', () => {
  const db = getDb();
  const suffix = Date.now().toString();
  const adminId = `academic-context-admin-${suffix}`;
  const studentId = `academic-context-student-${suffix}`;

  beforeEach(async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: adminId, role: 'admin' } as any,
      session: {} as any,
    });
    await db.insert(users).values([
      {
        id: adminId,
        name: 'Academic Context Admin',
        email: `${adminId}@example.test`,
        role: 'admin',
      },
      {
        id: studentId,
        name: 'Academic Context Student',
        email: `${studentId}@example.test`,
        role: 'student',
      },
    ]);
  });

  afterEach(async () => {
    await db.delete(auditLog).where(eq(auditLog.actorId, adminId));
    await db.delete(sectionEnrollments).where(eq(sectionEnrollments.userId, studentId));
    await db.delete(courseSections).where(eq(courseSections.code, `A-${suffix}`));
    await db.delete(courses).where(eq(courses.code, `IF-${suffix}`));
    await db.delete(academicTerms).where(eq(academicTerms.code, `TERM-${suffix}`));
    await db.delete(users).where(eq(users.id, adminId));
    await db.delete(users).where(eq(users.id, studentId));
  });

  it('persists term, course, section, and enrollment context', async () => {
    const termResult = await createAcademicTermHandler({
      data: {
        code: `TERM-${suffix}`,
        name: 'Integration Term',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2027-01-31'),
        status: 'draft',
      },
    });
    expect(termResult).toMatchObject({ term: { code: `TERM-${suffix}` } });
    if ('error' in termResult) return;

    const courseResult = await createCourseHandler({
      data: { code: `IF-${suffix}`, name: 'Integration Algorithms', description: null },
    });
    expect(courseResult).toMatchObject({ course: { code: `IF-${suffix}` } });
    if ('error' in courseResult) return;

    const sectionResult = await createCourseSectionHandler({
      data: {
        termId: termResult.term.id,
        courseId: courseResult.course.id,
        code: `A-${suffix}`,
        name: 'Integration Section A',
        status: 'active',
      },
    });
    expect(sectionResult).toMatchObject({ section: { code: `A-${suffix}` } });
    if ('error' in sectionResult) return;

    const enrollmentResult = await addSectionEnrollmentHandler({
      data: {
        sectionId: sectionResult.section.id,
        userId: studentId,
        role: 'student',
        isActive: true,
      },
    });
    expect(enrollmentResult).toMatchObject({ enrollment: { userId: studentId, role: 'student' } });

    const [enrollment] = await db
      .select()
      .from(sectionEnrollments)
      .where(eq(sectionEnrollments.userId, studentId));
    expect(enrollment.sectionId).toBe(sectionResult.section.id);
  });

  it('rejects duplicate enrollment without creating a second row', async () => {
    const termResult = await createAcademicTermHandler({
      data: {
        code: `TERM-${suffix}`,
        name: 'Integration Term',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2027-01-31'),
        status: 'draft',
      },
    });
    if ('error' in termResult) return;
    const courseResult = await createCourseHandler({
      data: { code: `IF-${suffix}`, name: 'Integration Algorithms', description: null },
    });
    if ('error' in courseResult) return;
    const sectionResult = await createCourseSectionHandler({
      data: {
        termId: termResult.term.id,
        courseId: courseResult.course.id,
        code: `A-${suffix}`,
        name: 'Integration Section A',
        status: 'active',
      },
    });
    if ('error' in sectionResult) return;

    await expect(
      addSectionEnrollmentHandler({
        data: {
          sectionId: sectionResult.section.id,
          userId: studentId,
          role: 'student',
          isActive: true,
        },
      }),
    ).resolves.toMatchObject({ enrollment: { userId: studentId } });
    await expect(
      addSectionEnrollmentHandler({
        data: {
          sectionId: sectionResult.section.id,
          userId: studentId,
          role: 'student',
          isActive: true,
        },
      }),
    ).resolves.toMatchObject({ error: { code: 'CONFLICT' } });

    const enrollments = await db
      .select()
      .from(sectionEnrollments)
      .where(eq(sectionEnrollments.userId, studentId));
    expect(enrollments).toHaveLength(1);
  });
});
