/** @vitest-environment node */
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({
  getEnv: () => ({
    LOG_LEVEL: 'silent',
    DATABASE_URL:
      process.env.MIGRATE_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql://simak:simak_password@localhost:5433/simak_test',
  }),
}));
vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));

import { getDb } from '@/db/index';
import {
  academicTerms,
  courses,
  courseSections,
  sectionEnrollments,
} from '@/db/schema/academic-context';
import { users } from '@/db/schema/users';
import { getSessionFromHeaders } from '@/server/auth';
import { getReportCatalogHandler } from '@/server/reporting.server';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const instructorId = `report-instructor-${suffix}`;
const studentId = `report-student-${suffix}`;
const adminId = `report-admin-${suffix}`;
let termId: number;
let courseId: number;
let enrolledSectionId: number;
let otherSectionId: number;

describe('reporting catalog authorization', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values([
      {
        id: instructorId,
        name: 'Report Instructor',
        email: `${instructorId}@test.local`,
        role: 'instructor',
      },
      { id: studentId, name: 'Report Student', email: `${studentId}@test.local`, role: 'student' },
      { id: adminId, name: 'Report Admin', email: `${adminId}@test.local`, role: 'admin' },
    ]);
    const [term] = await db
      .insert(academicTerms)
      .values({
        code: `TERM-${suffix}`,
        name: 'Reporting term',
        startDate: '2026-08-01',
        endDate: '2026-12-31',
        status: 'active',
      })
      .returning({ id: academicTerms.id });
    termId = term!.id;
    const [course] = await db
      .insert(courses)
      .values({ code: `COURSE-${suffix}`, name: 'Reporting course', credits: '3.00' })
      .returning({ id: courses.id });
    courseId = course!.id;
    const sections = await db
      .insert(courseSections)
      .values([
        { termId, courseId, code: `A-${suffix}`, cohort: '2026' },
        { termId, courseId, code: `B-${suffix}`, cohort: '2027' },
      ])
      .returning({ id: courseSections.id });
    enrolledSectionId = sections[0]!.id;
    otherSectionId = sections[1]!.id;
    await db.insert(sectionEnrollments).values([
      { sectionId: enrolledSectionId, userId: instructorId, role: 'instructor' },
      { sectionId: enrolledSectionId, userId: studentId, role: 'student' },
    ]);
  });

  beforeEach(() => vi.clearAllMocks());

  afterAll(async () => {
    const db = getDb();
    await db
      .delete(sectionEnrollments)
      .where(inArray(sectionEnrollments.userId, [instructorId, studentId]));
    await db
      .delete(courseSections)
      .where(inArray(courseSections.id, [enrolledSectionId, otherSectionId]));
    await db.delete(academicTerms).where(eq(academicTerms.id, termId));
    await db.delete(courses).where(eq(courses.id, courseId));
    await db.delete(users).where(inArray(users.id, [instructorId, studentId, adminId]));
  });

  it.each([
    ['instructor', instructorId, ['analytics_summary']],
    ['student', studentId, ['official_transcript']],
  ] as const)('limits %s options to active enrollments', async (role, userId, reports) => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({ user: { id: userId, role } } as never);
    const result = await getReportCatalogHandler({ data: {} });

    expect(result).toMatchObject({ reports, filters: { cohorts: ['2026'] } });
    if ('filters' in result)
      expect(result.filters.sections.map(({ id }) => id)).toEqual([enrolledSectionId]);
  });

  it('allows admins to see all current academic-context options', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: adminId, role: 'admin' },
    } as never);
    const result = await getReportCatalogHandler({ data: {} });

    if (!('filters' in result)) throw new Error('Expected authorized catalog');
    expect(result.filters.sections.map(({ id }) => id)).toEqual(
      expect.arrayContaining([enrolledSectionId, otherSectionId]),
    );
    expect(result.filters.cohorts).toEqual(expect.arrayContaining(['2026', '2027']));
  });
});
