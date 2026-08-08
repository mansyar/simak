/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AcademicTermIdSchema,
  AddSectionEnrollmentSchema,
  CreateAcademicTermSchema,
  CreateCourseSchema,
  CreateCourseSectionSchema,
  ListAcademicTermsSchema,
  ListCourseSectionsSchema,
  ListSectionEnrollmentsSchema,
  RemoveSectionEnrollmentSchema,
  UpdateAcademicTermSchema,
} from '@/server/academic-context';
import {
  createAcademicTermHandler,
  createCourseSectionHandler,
  listAcademicTermsHandler,
  listCourseSectionsHandler,
} from '@/server/academic-context.server';
import { archiveCourseSectionHandler } from '@/server/academic-context-archive.server';
import {
  addSectionEnrollmentHandler,
  updateSectionEnrollmentHandler,
} from '@/server/academic-context-enrollments.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
  safeAuditLog: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

type MockDb = Record<string, any>;

function createMockDb(): MockDb {
  const db: MockDb = {};
  for (const method of [
    'select',
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'innerJoin',
    'leftJoin',
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
  db.transaction = vi.fn(async (callback: (tx: MockDb) => unknown) => callback(db));
  db.then = vi.fn((onfulfilled: (value: unknown[]) => unknown) =>
    Promise.resolve([]).then(onfulfilled),
  );
  return db;
}

function sessionFor(role: 'superadmin' | 'admin' | 'instructor' | 'student') {
  return {
    user: { id: `${role}-1`, role, name: role, email: `${role}@example.test` },
    session: {},
  } as any;
}

describe('academic context schemas', () => {
  it('accepts a term and defaults it to draft', () => {
    const result = CreateAcademicTermSchema.safeParse({
      code: '2026/2027-GASAL',
      name: 'Gasal 2026/2027',
      startDate: '2026-08-01',
      endDate: '2027-01-31',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
      expect(result.data.startDate).toBeInstanceOf(Date);
    }
  });

  it('rejects an invalid term date range and empty identifiers', () => {
    expect(
      CreateAcademicTermSchema.safeParse({
        code: '',
        name: 'Invalid term',
        startDate: '2027-01-31',
        endDate: '2026-08-01',
      }).success,
    ).toBe(false);
  });

  it('validates course, section, and enrollment inputs', () => {
    expect(
      CreateCourseSchema.safeParse({ code: 'IF101', name: 'Algorithms', credits: 3 }).success,
    ).toBe(true);
    expect(
      CreateCourseSectionSchema.safeParse({ termId: '1', courseId: '2', code: 'A' }).success,
    ).toBe(true);
    expect(
      AddSectionEnrollmentSchema.safeParse({
        sectionId: '1',
        userId: 'student-1',
        role: 'student',
      }).success,
    ).toBe(true);
    expect(
      AddSectionEnrollmentSchema.safeParse({
        sectionId: 1,
        userId: 'student-1',
        role: 'administrator',
      }).success,
    ).toBe(false);
  });

  it('coerces ids and applies list defaults and filters', () => {
    expect(AcademicTermIdSchema.parse({ id: '7' })).toEqual({ id: 7 });
    expect(ListAcademicTermsSchema.parse({})).toMatchObject({ page: 1, limit: 20, search: '' });
    expect(ListCourseSectionsSchema.parse({ termId: '4', status: 'inactive' })).toMatchObject({
      termId: 4,
      status: 'inactive',
      page: 1,
    });
    expect(ListSectionEnrollmentsSchema.parse({ sectionId: '4', role: 'student' })).toMatchObject({
      sectionId: 4,
      role: 'student',
      page: 1,
    });
    expect(RemoveSectionEnrollmentSchema.safeParse({ sectionId: 1, userId: '' }).success).toBe(
      false,
    );
  });

  it('requires the update schema to preserve the term date invariant', () => {
    expect(
      UpdateAcademicTermSchema.safeParse({
        id: 1,
        code: '2026/2027-GASAL',
        name: 'Gasal 2026/2027',
        startDate: '2026-08-01',
        endDate: '2027-01-31',
      }).success,
    ).toBe(true);
    expect(UpdateAcademicTermSchema.safeParse({ id: 1, code: 'x' }).success).toBe(false);
  });
});

describe('academic context server handlers', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it.each(['instructor', 'student'] as const)(
    'rejects %s before querying protected context data',
    async (role) => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(sessionFor(role));

      await expect(
        listAcademicTermsHandler({ data: { page: 1, limit: 20, search: '', status: '' } }),
      ).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } });
      expect(mockDb.select).not.toHaveBeenCalled();
    },
  );

  it('rejects an unauthenticated context request before database access', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    await expect(
      listAcademicTermsHandler({ data: { page: 1, limit: 20, search: '', status: '' } }),
    ).resolves.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it.each(['admin', 'superadmin'] as const)(
    'allows %s to list explicit term projections',
    async (role) => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(sessionFor(role));
      mockDb.then
        .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
          Promise.resolve([
            {
              id: 1,
              code: '2026/2027-GASAL',
              name: 'Gasal 2026/2027',
              startDate: '2026-08-01',
              endDate: '2027-01-31',
              status: 'draft',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );

      await expect(
        listAcademicTermsHandler({ data: { page: 1, limit: 20, search: '', status: '' } }),
      ).resolves.toEqual({
        terms: [
          {
            id: 1,
            code: '2026/2027-GASAL',
            name: 'Gasal 2026/2027',
            startDate: '2026-08-01',
            endDate: '2027-01-31',
            status: 'draft',
          },
        ],
        total: 1,
      });
    },
  );

  it('creates a term through an admin transaction boundary and returns its projection', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(sessionFor('admin'));
    mockDb.then
      .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([{ id: 11, code: '2026/2027-GASAL' }]).then(onfulfilled),
      );

    await expect(
      createAcademicTermHandler({
        data: {
          code: '2026/2027-GASAL',
          name: 'Gasal 2026/2027',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2027-01-31'),
          status: 'draft',
        },
      }),
    ).resolves.toMatchObject({ term: { id: 11, code: '2026/2027-GASAL' } });
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('returns a conflict for an existing section identity', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(sessionFor('superadmin'));
    mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
      Promise.resolve([{ id: 8 }]).then(onfulfilled),
    );

    await expect(
      createCourseSectionHandler({
        data: { termId: 1, courseId: 2, code: 'A', name: 'Section A', status: 'active' },
      }),
    ).resolves.toMatchObject({ error: { code: 'CONFLICT' } });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('filters sections by term and status with pagination', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(sessionFor('admin'));
    mockDb.then
      .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([{ id: 4, termId: 1, courseId: 2, code: 'A', status: 'inactive' }]).then(
          onfulfilled,
        ),
      )
      .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([{ count: 1 }]).then(onfulfilled),
      );

    await expect(
      listCourseSectionsHandler({
        data: { page: 2, limit: 10, termId: 1, courseId: 2, status: 'inactive', search: '' },
      }),
    ).resolves.toMatchObject({
      sections: [{ id: 4, termId: 1, courseId: 2, status: 'inactive' }],
      total: 1,
    });
    expect(mockDb.offset).toHaveBeenCalledWith(10);
    expect(mockDb.limit).toHaveBeenCalledWith(10);
  });

  it('rejects enrollment for an inactive user or a mismatched role', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(sessionFor('admin'));
    mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
      Promise.resolve([{ id: 'student-1', role: 'student', deletedAt: new Date() }]).then(
        onfulfilled,
      ),
    );

    await expect(
      addSectionEnrollmentHandler({
        data: { sectionId: 3, userId: 'student-1', role: 'student', isActive: true },
      }),
    ).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('uses a transaction for enrollment writes and rejects cross-section updates', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(sessionFor('admin'));
    mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
      Promise.resolve([]).then(onfulfilled),
    );

    await expect(
      updateSectionEnrollmentHandler({
        data: { id: 7, sectionId: 99, role: 'student', isActive: true },
      }),
    ).resolves.toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('archives a section without deleting its historical row', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(sessionFor('admin'));
    mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
      Promise.resolve([{ id: 5, status: 'active' }]).then(onfulfilled),
    );

    await expect(archiveCourseSectionHandler({ data: { id: 5 } })).resolves.toMatchObject({
      success: true,
    });
    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('does not expose arbitrary database columns in section responses', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(sessionFor('admin'));
    mockDb.then
      .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([{ id: 4, code: 'A', status: 'active' }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([{ count: 1 }]).then(onfulfilled),
      );

    const result = await listCourseSectionsHandler({
      data: { page: 1, limit: 20, termId: 1, courseId: 2, status: '', search: '' },
    });
    if ('error' in result) return;
    expect(result).toEqual({ sections: [{ id: 4, code: 'A', status: 'active' }], total: 1 });
    expect(result.sections[0]).not.toHaveProperty('deletedAt');
  });

  it('requires the section id when removing an enrollment', () => {
    expect(RemoveSectionEnrollmentSchema.safeParse({ userId: 'student-1' }).success).toBe(false);
  });
});
