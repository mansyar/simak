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
  getCourseSectionHandler,
  listCourseSectionsHandler,
  listCoursesHandler,
  updateAcademicTermHandler,
  updateCourseHandler,
  updateCourseSectionHandler,
} from '@/server/academic-context.server';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ safeAuditLog: vi.fn() }));

type MockDb = Record<string, any> & {
  then: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
};

const admin = { user: { id: 'admin-1', role: 'admin' }, session: {} };
const input = {
  code: '2026/2027-GASAL',
  name: 'Gasal',
  startDate: new Date(),
  endDate: new Date(),
  status: 'draft',
} as any;
const section = { id: 1, termId: 2, courseId: 3, code: 'A', name: 'A', status: 'active' } as any;

function dbWith(...results: unknown[][]): MockDb {
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
  db.then = vi.fn((resolve: (value: unknown[]) => unknown, reject?: (error: unknown) => unknown) =>
    Promise.resolve(queue.shift() ?? []).then(resolve, reject),
  );
  db.transaction = vi.fn(async (callback: (tx: MockDb) => unknown) => callback(db));
  return db;
}

function setDb(...results: unknown[][]) {
  const db = dbWith(...results);
  vi.mocked(dbMod.getDb).mockReturnValue(db as any);
  return db;
}

function rejectNext(db: MockDb, error: unknown) {
  db.then.mockImplementationOnce(
    (_resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => {
      reject?.(error);
    },
  );
}

function code(result: unknown) {
  return result && typeof result === 'object' && 'error' in result
    ? (result as { error: { code: string } }).error.code
    : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(admin as any);
});

describe('academic context authorization and failure branches', () => {
  it('rejects unauthenticated and non-admin calls before querying', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    expect(code(await archiveAcademicTermHandler({ data: { id: 1 } }))).toBe('UNAUTHORIZED');
    expect(code(await archiveCourseHandler({ data: { id: 1 } }))).toBe('UNAUTHORIZED');
    expect(code(await archiveCourseSectionHandler({ data: { id: 1 } }))).toBe('UNAUTHORIZED');
    expect(
      code(
        await addSectionEnrollmentHandler({
          data: { sectionId: 1, userId: 'u', role: 'student', isActive: true },
        } as any),
      ),
    ).toBe('UNAUTHORIZED');

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'i', role: 'instructor' },
      session: {},
    } as any);
    expect(code(await archiveAcademicTermHandler({ data: { id: 1 } }))).toBe('FORBIDDEN');
    expect(
      code(
        await listSectionEnrollmentsHandler({ data: { sectionId: 1, page: 1, limit: 10 } } as any),
      ),
    ).toBe('FORBIDDEN');
    expect(
      code(await listCoursesHandler({ data: { page: 1, limit: 10, search: '' } } as any)),
    ).toBe('FORBIDDEN');
  });

  it('maps archive term and course failures to internal errors', async () => {
    const termDb = setDb([{ id: 1, status: 'active' }]);
    rejectNext(termDb, new Error('term update failed'));
    expect(code(await archiveAcademicTermHandler({ data: { id: 1 } }))).toBe('INTERNAL');

    const courseDb = setDb([{ id: 1 }]);
    rejectNext(courseDb, new Error('course update failed'));
    expect(code(await archiveCourseHandler({ data: { id: 1 } }))).toBe('INTERNAL');

    const sectionDb = setDb([{ id: 1, status: 'active' }]);
    rejectNext(sectionDb, 'section update failed');
    expect(code(await archiveCourseSectionHandler({ data: { id: 1 } }))).toBe('INTERNAL');
  });

  it('maps enrollment unique and transaction failures', async () => {
    const uniqueDb = setDb(
      [{ id: 1, status: 'active' }],
      [{ id: 'u', role: 'student', deletedAt: null }],
      [],
    );
    rejectNext(uniqueDb, { code: '23505' });
    expect(
      code(
        await addSectionEnrollmentHandler({
          data: { sectionId: 1, userId: 'u', role: 'student', isActive: true },
        } as any),
      ),
    ).toBe('CONFLICT');

    const failedDb = setDb();
    failedDb.transaction.mockRejectedValue(new Error('transaction failed'));
    expect(
      code(
        await updateSectionEnrollmentHandler({
          data: { id: 1, sectionId: 1, role: 'student', isActive: true },
        } as any),
      ),
    ).toBe('INTERNAL');
    expect(
      code(await removeSectionEnrollmentHandler({ data: { sectionId: 1, userId: 'u' } } as any)),
    ).toBe('INTERNAL');
  });

  it('covers enrollment list and section detail database failures', async () => {
    const listDb = setDb();
    rejectNext(listDb, new Error('list failed'));
    expect(
      code(
        await listSectionEnrollmentsHandler({ data: { sectionId: 1, page: 1, limit: 10 } } as any),
      ),
    ).toBe('INTERNAL');

    const sectionsDb = setDb();
    rejectNext(sectionsDb, new Error('sections failed'));
    expect(code(await listCourseSectionsHandler({ data: { page: 1, limit: 10 } } as any))).toBe(
      'INTERNAL',
    );

    const detailDb = setDb();
    rejectNext(detailDb, new Error('detail failed'));
    expect(code(await getCourseSectionHandler({ data: { id: 1 } }))).toBe('INTERNAL');
  });

  it('covers mutation no-row and unique-error branches', async () => {
    setDb([], [{ id: 2, status: 'active' }], [{ id: 3, archivedAt: null }], []);
    expect(
      code(
        await createCourseSectionHandler({ data: { ...section, termId: 2, courseId: 3 } } as any),
      ),
    ).toBe('INTERNAL');

    setDb([{ id: 1, status: 'active' }], []);
    expect(await updateCourseSectionHandler({ data: section } as any)).toEqual({ section: null });

    const sectionDb = setDb([{ id: 1, status: 'active' }]);
    rejectNext(sectionDb, { code: '23505' });
    expect(code(await updateCourseSectionHandler({ data: section } as any))).toBe('CONFLICT');

    const courseDb = setDb([{ id: 1, archivedAt: null }]);
    rejectNext(courseDb, { code: '23505' });
    expect(
      code(
        await updateCourseHandler({ data: { id: 1, code: 'IF101', name: 'Algorithms' } } as any),
      ),
    ).toBe('CONFLICT');

    const termDb = setDb([{ id: 1, status: 'active' }]);
    rejectNext(termDb, { code: '23505' });
    expect(code(await updateAcademicTermHandler({ data: { id: 1, ...input } } as any))).toBe(
      'CONFLICT',
    );

    const sectionUniqueDb = setDb([], [{ id: 2, status: 'active' }], [{ id: 3, archivedAt: null }]);
    rejectNext(sectionUniqueDb, { code: '23505' });
    expect(
      code(
        await createCourseSectionHandler({ data: { ...section, termId: 2, courseId: 3 } } as any),
      ),
    ).toBe('CONFLICT');

    setDb([], [{ id: 1, code: 'IF101', name: 'Algorithms' }]);
    expect(
      await createCourseHandler({ data: { code: 'IF101', name: 'Algorithms' } } as any),
    ).toMatchObject({ course: { id: 1 } });
  });
});
