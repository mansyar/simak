/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { getDb } from '@/db/index';
import { academicRecords } from '@/db/schema/academic-records';
import { finalGrades } from '@/db/schema/gradebook';
import { getSessionFromHeaders } from '@/server/auth';
import {
  AnalyticsSummaryInputSchema,
  InstitutionalAcademicSummaryInputSchema,
  OfficialTranscriptInputSchema,
} from '@/server/reporting';
import {
  getAnalyticsSummaryHandler,
  getInstitutionalAcademicSummaryHandler,
  getOfficialTranscriptHandler,
} from '@/server/reporting-loaders.server';

function mockDb(results: unknown[][]) {
  const fromTables: unknown[] = [];
  const limits: number[] = [];
  let index = 0;
  const db = {
    execute: vi.fn(() => Promise.resolve(results[index++] ?? [])),
    select: vi.fn(() => {
      const result = results[index++] ?? [];
      const query: Record<string, unknown> = {};
      for (const method of ['innerJoin', 'leftJoin', 'where', 'groupBy', 'orderBy']) {
        query[method] = vi.fn(() => query);
      }
      query.from = vi.fn((table) => {
        fromTables.push(table);
        return query;
      });
      query.limit = vi.fn((limit) => {
        limits.push(limit);
        return Promise.resolve(result);
      });
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
      return query;
    }),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  return { db, fromTables, limits };
}

const filters = { termId: 1, courseId: 2, sectionId: 3, cohort: '2026' };
const scope = [{ sectionId: 3 }];

describe('report data loaders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes the allowlisted filter schemas and bounds transcript subjects', () => {
    expect(InstitutionalAcademicSummaryInputSchema.parse({ cohort: ' 2026 ' })).toEqual({
      termId: null,
      courseId: null,
      sectionId: null,
      cohort: '2026',
    });
    expect(AnalyticsSummaryInputSchema.parse({})).toEqual({
      termId: null,
      courseId: null,
      sectionId: null,
      cohort: null,
    });
    expect(OfficialTranscriptInputSchema.parse({ studentId: ' student-1 ' })).toMatchObject({
      studentId: 'student-1',
    });
    expect(
      InstitutionalAcademicSummaryInputSchema.parse({ cohort: 'x'.repeat(120) }).cohort,
    ).toHaveLength(120);
  });

  it('loads an institutional summary only for administrators from immutable records', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    } as never);
    const { fromTables, limits } = mockDb([
      scope,
      [
        {
          studentCount: 8,
          recordCount: 10,
          totalCredits: '30.00',
          averageScore: '84.50',
        },
      ],
      [{ status: 'complete', recordCount: 10 }],
    ]);

    await expect(getInstitutionalAcademicSummaryHandler({ data: filters })).resolves.toEqual({
      filters,
      totals: {
        students: 8,
        records: 10,
        credits: 30,
        averageScore: 84.5,
      },
      outcomes: [{ status: 'complete', count: 10 }],
    });
    expect(fromTables).toContain(academicRecords);
    expect(fromTables).not.toContain(finalGrades);
    expect(limits).toContain(100);
  });

  it('limits instructor analytics to actively enrolled sections', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'instructor-1', role: 'instructor' },
    } as never);
    mockDb([
      scope,
      [
        {
          sectionId: 3,
          sectionCode: 'A',
          students: 12,
          activeAssignments: 2,
          passedCheckpoints: 18,
          totalCheckpoints: 24,
        },
      ],
    ]);

    await expect(getAnalyticsSummaryHandler({ data: filters })).resolves.toEqual({
      filters,
      sections: [
        {
          sectionId: 3,
          sectionCode: 'A',
          students: 12,
          activeAssignments: 2,
          passedCheckpoints: 18,
          totalCheckpoints: 24,
          completionRate: 75,
        },
      ],
    });
  });

  it('keeps no-filter instructor analytics scoped by active enrollment', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'instructor-1', role: 'instructor' },
    } as never);
    const { db } = mockDb([[]]);

    await getAnalyticsSummaryHandler({
      data: AnalyticsSummaryInputSchema.parse({}),
    });

    expect(db.select).toHaveBeenCalledOnce();
    const query = vi.mocked(db.select).mock.results[0]?.value as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
    expect(query.innerJoin).toHaveBeenCalled();
    expect(query.where).toHaveBeenCalled();
  });

  it('uses the same response for nonexistent and unauthorized filter scopes', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'instructor-1', role: 'instructor' },
    } as never);
    mockDb([[]]);
    const unauthorized = await getAnalyticsSummaryHandler({ data: filters });

    vi.clearAllMocks();
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    } as never);
    mockDb([[]]);
    const nonexistent = await getInstitutionalAcademicSummaryHandler({ data: filters });

    expect(unauthorized).toEqual({
      error: { code: 'NOT_FOUND', message: 'Report data not found' },
    });
    expect(nonexistent).toEqual(unauthorized);
  });

  it('loads a student self transcript only from immutable academic records', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'student-1', role: 'student' },
    } as never);
    const { fromTables, limits } = mockDb([
      [{ studentId: 'student-1', studentName: 'Student One' }],
      scope,
      [
        {
          gpa: '4.00',
          totalCredits: '3.00',
          totalQualityPoints: '12.00',
          eligibleRecordIds: [9],
        },
      ],
      [
        {
          gpa: '4.00',
          totalCredits: '3.00',
          totalQualityPoints: '12.00',
          eligibleRecordIds: [9],
        },
      ],
      [
        {
          recordId: 9,
          courseCode: 'IF101',
          courseName: 'Algorithms',
          sectionCode: 'A',
          termCode: '2026-1',
          termName: 'Term 1',
          status: 'complete',
          numericScore: '90.00',
          letterGrade: 'A',
          credits: '3.00',
          gradePoints: '4.00',
          publishedAt: new Date('2026-06-01T00:00:00Z'),
        },
      ],
    ]);

    const result = await getOfficialTranscriptHandler({
      data: OfficialTranscriptInputSchema.parse(filters),
    });

    expect(result).toMatchObject({
      student: { id: 'student-1', name: 'Student One' },
      termGpa: { gpa: 4, totalCredits: 3, totalQualityPoints: 12, eligibleRecordIds: [9] },
      cumulativeGpa: { gpa: 4, totalCredits: 3, totalQualityPoints: 12, eligibleRecordIds: [9] },
      records: [expect.objectContaining({ recordId: 9, numericScore: 90, credits: 3 })],
    });
    expect(fromTables).toContain(academicRecords);
    expect(fromTables).not.toContain(finalGrades);
    expect(limits).toContain(500);
  });

  it('rejects a student-selected transcript subject without revealing existence', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'student-1', role: 'student' },
    } as never);
    mockDb([]);

    await expect(
      getOfficialTranscriptHandler({
        data: OfficialTranscriptInputSchema.parse({ studentId: 'student-2' }),
      }),
    ).resolves.toEqual({ error: { code: 'NOT_FOUND', message: 'Report data not found' } });
    expect(getDb).not.toHaveBeenCalled();
  });
});
