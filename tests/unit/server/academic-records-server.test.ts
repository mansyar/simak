/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GetAdminAcademicRecordsSchema,
  GetInstructorAcademicRecordsSchema,
  GetStudentAcademicRecordsSchema,
} from '@/server/academic-records';
import {
  getAdminAcademicRecordsHandler,
  getInstructorAcademicRecordsHandler,
  getStudentAcademicRecordsHandler,
} from '@/server/academic-records-extras.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/server-fn', () => ({
  serverFnMiddlewares: vi.fn(() => []),
  typedServerFn: vi.fn(() => ({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  })),
}));

const studentSession = {
  user: { id: 'student-1', role: 'student' },
  session: {},
};

const instructorSession = {
  user: { id: 'instructor-1', role: 'instructor' },
  session: {},
};

const adminSession = {
  user: { id: 'admin-1', role: 'admin' },
  session: {},
};

const academicRecord = {
  recordId: 11,
  studentId: 'student-1',
  studentName: 'Student One',
  courseId: 9,
  courseCode: 'CS101',
  courseName: 'Algorithms',
  courseSectionId: 7,
  sectionCode: 'A',
  termId: 3,
  termCode: '2026-1',
  termName: 'Spring 2026',
  termStartDate: '2026-01-01',
  sourceAssignmentId: 42,
  sourceReleaseVersion: 1,
  policyVersion: 2,
  recordVersion: 1,
  numericScore: '91.25',
  letterGrade: 'A',
  status: 'complete',
  credits: '3.00',
  gradePoints: '4.00',
  publishedAt: new Date('2026-02-01T10:00:00Z'),
  createdAt: new Date('2026-02-01T10:00:00Z'),
};

function createMockDb(selectResults: unknown[]) {
  let selectIndex = 0;
  const db: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(() => {
      const result = selectResults[selectIndex++];
      const query = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve(result).then(onFulfilled),
      };
      return query;
    }),
  };

  return db;
}

describe('academic-record server functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates role-specific inputs with safe pagination defaults', () => {
    expect(GetStudentAcademicRecordsSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(GetInstructorAcademicRecordsSchema.parse({ sectionId: 7 })).toEqual({
      sectionId: 7,
      page: 1,
      limit: 20,
    });
    expect(GetAdminAcademicRecordsSchema.parse({ studentId: 'student-1' })).toEqual({
      studentId: 'student-1',
      page: 1,
      limit: 20,
    });
  });

  it('returns only the current student records with term and cumulative GPA', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as never);
    const db = createMockDb([[academicRecord], [{ count: '1' }], [academicRecord]]);
    vi.mocked(dbMod.getDb).mockReturnValue(db as never);

    const result = await getStudentAcademicRecordsHandler({
      data: { termId: 3, page: 1, limit: 20 },
    });

    expect(result).toMatchObject({
      page: 1,
      limit: 20,
      total: 1,
      records: [expect.objectContaining({ studentId: 'student-1', policyVersion: 2 })],
      termGpa: expect.objectContaining({ gpa: 4, totalCredits: 3 }),
      cumulativeGpa: expect.objectContaining({ gpa: 4, totalCredits: 3 }),
    });
  });

  it('denies instructors without an active enrollment in the requested section', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as never);
    const db = createMockDb([[]]);
    vi.mocked(dbMod.getDb).mockReturnValue(db as never);

    const result = await getInstructorAcademicRecordsHandler({
      data: { sectionId: 999, page: 1, limit: 20 },
    });

    expect(result).toEqual({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
  });

  it('returns records only after confirming instructor section authorization', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as never);
    const db = createMockDb([
      [{ sectionId: 7 }],
      [academicRecord],
      [{ count: '1' }],
      [academicRecord],
    ]);
    vi.mocked(dbMod.getDb).mockReturnValue(db as never);

    const result = await getInstructorAcademicRecordsHandler({
      data: { sectionId: 7, page: 1, limit: 20 },
    });

    expect(result).toMatchObject({
      total: 1,
      records: [expect.objectContaining({ courseSectionId: 7 })],
    });
  });

  it('allows admins to inspect policy and source metadata for authorized records', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as never);
    const db = createMockDb([[academicRecord], [{ count: '1' }], [academicRecord]]);
    vi.mocked(dbMod.getDb).mockReturnValue(db as never);

    const result = await getAdminAcademicRecordsHandler({
      data: { studentId: 'student-1', page: 1, limit: 20 },
    });

    expect(result).toMatchObject({
      total: 1,
      records: [
        expect.objectContaining({
          sourceAssignmentId: 42,
          sourceReleaseVersion: 1,
          policyVersion: 2,
        }),
      ],
    });
  });

  it('rejects student access to administrative records', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as never);

    const result = await getAdminAcademicRecordsHandler({
      data: { page: 1, limit: 20 },
    });

    expect(result).toEqual({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
  });
});
