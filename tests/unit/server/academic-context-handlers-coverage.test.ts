/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import {
  archiveAcademicTermHandler,
  archiveCourseHandler,
  archiveCourseSectionHandler,
} from '@/server/academic-context-archive.server';
import {
  addSectionEnrollmentHandler,
  listSectionEnrollmentsHandler,
  removeSectionEnrollmentHandler,
  updateSectionEnrollmentHandler,
} from '@/server/academic-context-enrollments.server';
import {
  createAcademicTermHandler,
  createCourseHandler,
  createCourseSectionHandler,
  getAcademicTermHandler,
  getCourseHandler,
  getCourseSectionHandler,
  listAcademicTermsHandler,
  listCourseSectionsHandler,
  listCoursesHandler,
  updateAcademicTermHandler,
  updateCourseHandler,
  updateCourseSectionHandler,
} from '@/server/academic-context.server';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  safeAuditLog: vi.fn(),
}));

type MockDb = Record<string, any> & {
  then: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
};

function adminSession() {
  return { user: { id: 'admin-1', role: 'admin' }, session: {} } as any;
}

function createDb(results: unknown[][] = []): MockDb {
  const db = {} as MockDb;
  for (const method of [
    'select',
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'innerJoin',
    'insert',
    'values',
    'returning',
    'update',
    'set',
    'delete',
    'for',
  ]) {
    db[method] = vi.fn().mockReturnValue(db);
  }
  const queue = [...results];
  db.then = vi.fn(
    (onfulfilled: (value: unknown[]) => unknown, onrejected?: (reason: unknown) => unknown) =>
      Promise.resolve(queue.shift() ?? []).then(onfulfilled, onrejected),
  );
  db.transaction = vi.fn(async (callback: (tx: MockDb) => unknown) => callback(db));
  return db;
}

function useDb(...results: unknown[][]) {
  const db = createDb(results);
  vi.mocked(dbMod.getDb).mockReturnValue(db as any);
  return db;
}

function rejectNext(db: MockDb, reason: unknown) {
  db.then.mockImplementationOnce(
    (_onfulfilled: (value: unknown[]) => unknown, onrejected?: (error: unknown) => unknown) => {
      onrejected?.(reason);
    },
  );
}

function useSession(session: unknown = adminSession()) {
  vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(session as any);
}

function errorCode(result: unknown) {
  if (!result || typeof result !== 'object' || !('error' in result)) return undefined;
  return (result as { error: { code: string } }).error.code;
}

const termInput = {
  code: '2026/2027-GASAL',
  name: 'Gasal',
  startDate: new Date('2026-08-01'),
  endDate: new Date('2027-01-31'),
  status: 'draft',
} as any;

const courseInput = { code: 'IF101', name: 'Algorithms', description: 'Intro' } as any;
const sectionInput = {
  termId: 1,
  courseId: 2,
  code: 'A',
  name: 'Section A',
  status: 'active',
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  useSession();
});

describe('academic context list and detail branches', () => {
  it('lists terms with search/status filters and maps database errors', async () => {
    const db = useDb([{ id: 1, code: termInput.code, status: 'active' }], [{ count: 1 }]);
    const result = await listAcademicTermsHandler({
      data: { page: 1, limit: 10, search: 'Gasal', status: 'active' },
    });
    expect(result).toMatchObject({ total: 1 });
    expect(db.offset).toHaveBeenCalledWith(0);

    rejectNext(db, new Error('term list failed'));
    expect(
      errorCode(
        await listAcademicTermsHandler({ data: { page: 1, limit: 10, search: '', status: '' } }),
      ),
    ).toBe('INTERNAL');
  });

  it('returns term details, null results, and internal errors', async () => {
    useDb([{ id: 1, code: termInput.code }]);
    expect(await getAcademicTermHandler({ data: { id: 1 } as any })).toMatchObject({
      term: { id: 1 },
    });

    useDb([]);
    expect(await getAcademicTermHandler({ data: { id: 2 } as any })).toEqual({ term: null });

    const db = useDb();
    rejectNext(db, new Error('term detail failed'));
    expect(errorCode(await getAcademicTermHandler({ data: { id: 3 } as any }))).toBe('INTERNAL');
  });

  it('lists courses and sections with and without optional filters', async () => {
    useDb([{ id: 2, code: courseInput.code }], [{ count: 1 }]);
    expect(
      await listCoursesHandler({ data: { page: 1, limit: 10, search: 'IF' } as any }),
    ).toMatchObject({
      total: 1,
    });

    useDb([{ id: 3, code: 'A' }], [{ count: 1 }]);
    expect(
      await listCourseSectionsHandler({
        data: { page: 1, limit: 10, termId: 1, courseId: 2, status: 'active', search: 'A' },
      } as any),
    ).toMatchObject({ total: 1 });
  });

  it('returns course and section details including null rows', async () => {
    useDb([{ id: 2, code: courseInput.code }]);
    expect(await getCourseHandler({ data: { id: 2 } as any })).toMatchObject({ course: { id: 2 } });
    useDb([]);
    expect(await getCourseSectionHandler({ data: { id: 3 } as any })).toEqual({ section: null });
  });
});

describe('academic context mutation branches', () => {
  it('creates terms and courses, including conflict and empty-return responses', async () => {
    useDb([], [{ id: 1, code: termInput.code }]);
    expect(await createAcademicTermHandler({ data: termInput })).toMatchObject({ term: { id: 1 } });

    useDb([{ id: 1 }]);
    expect(errorCode(await createAcademicTermHandler({ data: termInput }))).toBe('CONFLICT');

    useDb([], []);
    expect(errorCode(await createCourseHandler({ data: courseInput }))).toBe('INTERNAL');

    const uniqueDb = useDb();
    rejectNext(uniqueDb, { code: '23505' });
    expect(errorCode(await createCourseHandler({ data: courseInput }))).toBe('CONFLICT');
  });

  it('updates terms and courses while preserving archive and missing guards', async () => {
    useDb([{ id: 1, status: 'active' }], [{ id: 1, code: termInput.code }]);
    expect(await updateAcademicTermHandler({ data: { id: 1, ...termInput } as any })).toMatchObject(
      {
        term: { id: 1 },
      },
    );

    useDb([{ id: 1, status: 'archived' }]);
    expect(
      errorCode(await updateAcademicTermHandler({ data: { id: 1, ...termInput } as any })),
    ).toBe('CONFLICT');

    useDb([{ id: 2, archivedAt: null }], [{ id: 2, code: courseInput.code }]);
    expect(await updateCourseHandler({ data: { id: 2, ...courseInput } as any })).toMatchObject({
      course: { id: 2 },
    });

    useDb([]);
    expect(errorCode(await updateCourseHandler({ data: { id: 3, ...courseInput } as any }))).toBe(
      'NOT_FOUND',
    );
  });

  it('creates sections and rejects unavailable context', async () => {
    useDb([], [{ id: 1, status: 'active' }], [{ id: 2, archivedAt: null }], [{ id: 3, code: 'A' }]);
    expect(await createCourseSectionHandler({ data: sectionInput })).toMatchObject({
      section: { id: 3 },
    });

    useDb([{ id: 3 }]);
    expect(errorCode(await createCourseSectionHandler({ data: sectionInput }))).toBe('CONFLICT');

    useDb([], [], [{ id: 2, archivedAt: null }]);
    expect(errorCode(await createCourseSectionHandler({ data: sectionInput }))).toBe('NOT_FOUND');

    useDb([], [{ id: 1, status: 'archived' }], [{ id: 2, archivedAt: null }]);
    expect(errorCode(await createCourseSectionHandler({ data: sectionInput }))).toBe('CONFLICT');
  });

  it('updates sections and rejects missing or archived records', async () => {
    useDb(
      [{ id: 3, status: 'active' }],
      [{ termStatus: 'active', courseArchivedAt: null }],
      [{ id: 3, code: 'A' }],
    );
    expect(
      await updateCourseSectionHandler({ data: { id: 3, ...sectionInput } as any }),
    ).toMatchObject({ section: { id: 3 } });

    useDb([{ id: 3, status: 'active' }], [{ termStatus: 'archived', courseArchivedAt: null }]);
    expect(
      errorCode(await updateCourseSectionHandler({ data: { id: 3, ...sectionInput } as any })),
    ).toBe('CONFLICT');

    useDb([{ id: 3, status: 'active' }], []);
    expect(
      errorCode(await updateCourseSectionHandler({ data: { id: 3, ...sectionInput } as any })),
    ).toBe('NOT_FOUND');

    useDb([{ id: 3, status: 'archived' }]);
    expect(
      errorCode(await updateCourseSectionHandler({ data: { id: 3, ...sectionInput } as any })),
    ).toBe('CONFLICT');
  });
});

describe('academic context archive branches', () => {
  it('archives terms, courses, and sections without deleting them', async () => {
    for (const handler of [
      archiveAcademicTermHandler,
      archiveCourseHandler,
      archiveCourseSectionHandler,
    ]) {
      const db = useDb([{ id: 1, status: 'active' }]);
      await expect(handler({ data: { id: 1 } as any })).resolves.toEqual({ success: true });
      expect(db.delete).not.toHaveBeenCalled();
    }
  });

  it('returns not found and internal errors for archive handlers', async () => {
    expect(errorCode(await archiveAcademicTermHandler({ data: { id: 1 } as any }))).toBe(
      'NOT_FOUND',
    );
    expect(errorCode(await archiveCourseHandler({ data: { id: 1 } as any }))).toBe('NOT_FOUND');
    expect(errorCode(await archiveCourseSectionHandler({ data: { id: 1 } as any }))).toBe(
      'NOT_FOUND',
    );

    const db = useDb([{ id: 1, status: 'active' }]);
    rejectNext(db, new Error('archive failed'));
    expect(errorCode(await archiveCourseSectionHandler({ data: { id: 1 } as any }))).toBe(
      'INTERNAL',
    );
  });
});

describe('academic context enrollment branches', () => {
  it('lists enrollments with filters and handles database errors', async () => {
    useDb([{ id: 1, userId: 'student-1' }], [{ count: 1 }]);
    expect(
      await listSectionEnrollmentsHandler({
        data: { sectionId: 1, page: 1, limit: 10, role: 'student', isActive: true },
      } as any),
    ).toMatchObject({ total: 1 });

    const db = useDb();
    rejectNext(db, new Error('enrollment list failed'));
    expect(
      errorCode(
        await listSectionEnrollmentsHandler({
          data: { sectionId: 1, page: 1, limit: 10 } as any,
        }),
      ),
    ).toBe('INTERNAL');
  });

  it('adds enrollments and validates section, user, role, and duplicates', async () => {
    useDb(
      [{ id: 1, status: 'active' }],
      [{ id: 'student-1', role: 'student', deletedAt: null }],
      [],
      [{ id: 9, userId: 'student-1' }],
    );
    expect(
      await addSectionEnrollmentHandler({
        data: { sectionId: 1, userId: 'student-1', role: 'student', isActive: true },
      } as any),
    ).toMatchObject({ enrollment: { id: 9 } });

    useDb([]);
    expect(
      errorCode(
        await addSectionEnrollmentHandler({
          data: { sectionId: 1, userId: 'u', role: 'student', isActive: true },
        } as any),
      ),
    ).toBe('NOT_FOUND');
    useDb([{ id: 1, status: 'archived' }]);
    expect(
      errorCode(
        await addSectionEnrollmentHandler({
          data: { sectionId: 1, userId: 'u', role: 'student', isActive: true },
        } as any),
      ),
    ).toBe('CONFLICT');
    useDb([{ id: 1, status: 'active' }], [{ id: 'u', role: 'student', deletedAt: new Date() }]);
    expect(
      errorCode(
        await addSectionEnrollmentHandler({
          data: { sectionId: 1, userId: 'u', role: 'student', isActive: true },
        } as any),
      ),
    ).toBe('BAD_REQUEST');
    useDb([{ id: 1, status: 'active' }], [{ id: 'u', role: 'instructor', deletedAt: null }]);
    expect(
      errorCode(
        await addSectionEnrollmentHandler({
          data: { sectionId: 1, userId: 'u', role: 'student', isActive: true },
        } as any),
      ),
    ).toBe('BAD_REQUEST');
    useDb(
      [{ id: 1, status: 'active' }],
      [{ id: 'u', role: 'student', deletedAt: null }],
      [{ id: 2 }],
    );
    expect(
      errorCode(
        await addSectionEnrollmentHandler({
          data: { sectionId: 1, userId: 'u', role: 'student', isActive: true },
        } as any),
      ),
    ).toBe('CONFLICT');
  });

  it('updates and removes enrollments with history-safe deactivation', async () => {
    useDb(
      [{ id: 7, userId: 'student-1' }],
      [{ id: 'student-1', role: 'student', deletedAt: null }],
      [{ id: 7, isActive: false, endedAt: new Date() }],
    );
    expect(
      await updateSectionEnrollmentHandler({
        data: { id: 7, sectionId: 1, role: 'student', isActive: false },
      } as any),
    ).toMatchObject({ enrollment: { id: 7 } });

    useDb([]);
    expect(
      errorCode(
        await updateSectionEnrollmentHandler({
          data: { id: 7, sectionId: 1, role: 'student', isActive: true },
        } as any),
      ),
    ).toBe('NOT_FOUND');

    useDb(
      [{ id: 7, userId: 'student-1' }],
      [{ id: 'student-1', role: 'instructor', deletedAt: null }],
    );
    expect(
      errorCode(
        await updateSectionEnrollmentHandler({
          data: { id: 7, sectionId: 1, role: 'student', isActive: true },
        } as any),
      ),
    ).toBe('BAD_REQUEST');

    useDb([{ id: 1, status: 'active' }], [{ id: 7 }]);
    expect(
      await removeSectionEnrollmentHandler({ data: { sectionId: 1, userId: 'student-1' } as any }),
    ).toEqual({
      success: true,
    });
    useDb([{ id: 1, status: 'archived' }]);
    expect(
      errorCode(
        await removeSectionEnrollmentHandler({
          data: { sectionId: 1, userId: 'student-1' } as any,
        }),
      ),
    ).toBe('CONFLICT');
    useDb([]);
    expect(
      errorCode(
        await removeSectionEnrollmentHandler({
          data: { sectionId: 1, userId: 'student-1' } as any,
        }),
      ),
    ).toBe('NOT_FOUND');
  });
});
