import { describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import { courseSections, sectionEnrollments } from '@/db/schema/academic-context';
import { assignmentStudents, assignments, checkpoints } from '@/db/schema/assignments';
import { assignmentGradeConfig } from '@/db/schema/gradebook';
import { templateCheckpoints } from '@/db/schema/templates';
import { users } from '@/db/schema/users';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, isServerError } from '@/lib/errors';
import * as assignmentContracts from '@/server/assignments';
import * as assignmentHandlers from '@/server/assignments.server';
import { getSessionFromHeaders } from '@/server/auth';
import {
  cloneAssignmentHandler,
  rolloverAssignmentHandler,
} from '@/server/assignments-clone-rollover.server';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ safeAuditLog: vi.fn() }));
vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));

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

const contracts = assignmentContracts as Record<string, unknown>;
const handlers = assignmentHandlers as Record<string, unknown>;

type SchemaLike = {
  parse: (value: unknown) => Record<string, unknown>;
};

describe('assignment clone and rollover contracts', () => {
  it('requires an absolute target deadline and defaults to no copied students', () => {
    const schema = contracts.CloneAssignmentSchema as SchemaLike | undefined;
    expect(schema).toBeDefined();
    if (!schema) return;

    const parsed = schema.parse({
      sourceAssignmentId: 10,
      targetSectionId: 20,
      finalDeadline: new Date('2030-06-01T00:00:00.000Z'),
    });

    expect(parsed).toMatchObject({
      sourceAssignmentId: 10,
      targetSectionId: 20,
      studentIds: [],
    });
    expect(() =>
      schema.parse({
        sourceAssignmentId: 10,
        targetSectionId: 20,
        relativeDeadlineDays: 30,
      }),
    ).toThrow();
  });

  it('exposes clone and semester rollover client-safe stubs', () => {
    expect(typeof contracts.cloneAssignment).toBe('function');
    expect(typeof contracts.rolloverAssignment).toBe('function');
  });

  it('exposes server handlers for both operations', () => {
    expect(typeof handlers.cloneAssignmentHandler).toBe('function');
    expect(typeof handlers.rolloverAssignmentHandler).toBe('function');
  });
});

type HandlerOptions = {
  sourceMode?: 'individual' | 'group';
  sourceStatus?: 'active' | 'archived' | 'draft';
  targetTermStatus?: 'draft' | 'active' | 'closed' | 'archived';
  targetRows?: unknown[];
  activeStudents?: unknown[];
  templateRows?: unknown[];
  gradeConfig?: unknown[];
};

function configureHandlerDb(options: HandlerOptions = {}) {
  const sourceStatus = options.sourceStatus ?? 'active';
  const sourceMode = options.sourceMode ?? 'individual';
  const inserted: Array<{ table: unknown; values: unknown }> = [];
  const rows = new Map<unknown, unknown[]>([
    [
      assignments,
      [
        {
          id: 10,
          templateId: 100,
          title: 'Source assignment',
          description: 'Source description',
          sectionId: 20,
          mode: sourceMode,
          status: sourceStatus,
          maxExtensionDays: 14,
          maxTotalExtensions: 5,
          deletedAt: null,
        },
      ],
    ],
    [
      courseSections,
      options.targetRows ?? [
        {
          id: 30,
          termStatus: options.targetTermStatus ?? 'active',
          sectionStatus: 'active',
        },
      ],
    ],
    [sectionEnrollments, options.activeStudents ?? [{ id: 'student-1' }]],
    [users, options.activeStudents ?? [{ id: 'student-1' }]],
    [
      templateCheckpoints,
      options.templateRows ?? [
        {
          id: 500,
          name: 'Checkpoint',
          order: 1,
          minConsultations: 0,
          estimatedDuration: 1,
        },
      ],
    ],
    [
      assignmentGradeConfig,
      options.gradeConfig ?? [
        {
          gradingScheme: 'custom_weight',
          customWeights: { 500: 100 },
          letterGradeBounds: { A: 90, B: 80 },
        },
      ],
    ],
  ]);

  const query = () => {
    let table: unknown;
    const builder: any = {
      from(nextTable: unknown) {
        table = nextTable;
        return builder;
      },
      innerJoin() {
        return builder;
      },
      where() {
        return builder;
      },
      orderBy() {
        return builder;
      },
      limit() {
        return builder;
      },
      for() {
        return Promise.resolve(rows.get(table) ?? []);
      },
      then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) {
        return Promise.resolve(rows.get(table) ?? []).then(resolve, reject);
      },
    };
    return builder;
  };

  let nextAssignmentId = 900;
  const tx = {
    select: vi.fn(() => query()),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        inserted.push({ table, values });
        return {
          returning: vi.fn(async () => [{ id: nextAssignmentId++ }]),
          then: (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
        };
      }),
    })),
  };
  const db = {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };

  vi.mocked(getDb).mockReturnValue(db as never);
  vi.mocked(getSessionFromHeaders).mockResolvedValue({
    user: { id: 'instructor-1', role: 'instructor' },
    session: {},
  } as never);
  vi.mocked(safeAuditLog).mockResolvedValue(undefined);

  return { db, inserted };
}

function cloneInput(overrides: Record<string, unknown> = {}) {
  return {
    sourceAssignmentId: 10,
    targetSectionId: 30,
    finalDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    studentIds: [],
    ...overrides,
  };
}

type HandlerLike = (input: { data: Record<string, unknown> }) => Promise<unknown>;

function expectHandlerError(result: unknown, code: ErrorCode) {
  expect(isServerError(result)).toBe(true);
  if (isServerError(result)) expect(result.error.code).toBe(code);
}

describe('assignment clone and rollover handlers', () => {
  it('creates fresh student participation, checkpoints, and reset grade configuration', async () => {
    const { inserted } = configureHandlerDb();
    const handler = cloneAssignmentHandler as HandlerLike;
    const result = await handler({ data: cloneInput({ studentIds: ['student-1'] }) });

    expect(result).toMatchObject({ success: true, status: 'draft', mode: 'individual' });
    expect(inserted.some(({ table }) => table === assignmentStudents)).toBe(true);
    const checkpointInsert = inserted.find(({ table }) => table === checkpoints);
    expect(checkpointInsert?.values).toEqual([
      expect.objectContaining({ state: 'unlocked', studentId: 'student-1' }),
    ]);
    expect(inserted).toContainEqual({
      table: assignmentGradeConfig,
      values: expect.objectContaining({ releaseStatus: 'draft', publishedAt: null }),
    });
    expect(safeAuditLog).toHaveBeenCalledWith(
      'assignment.cloned',
      expect.objectContaining({ actorId: 'instructor-1' }),
    );
  });

  it('creates a configuration-only rollover without copied students', async () => {
    const { inserted } = configureHandlerDb({ gradeConfig: [] });
    const handler = rolloverAssignmentHandler as HandlerLike;
    const result = await handler({ data: cloneInput() });

    expect(result).toMatchObject({ success: true, status: 'draft' });
    expect(inserted.some(({ table }) => table === assignmentStudents)).toBe(false);
    expect(inserted.some(({ table }) => table === checkpoints)).toBe(false);
    expect(inserted).toContainEqual({
      table: assignmentGradeConfig,
      values: expect.objectContaining({ gradingScheme: 'equal_weight', releaseStatus: 'draft' }),
    });
  });

  it('rejects unauthorized, duplicate, and past-deadline requests before writes', async () => {
    const { db } = configureHandlerDb();
    vi.mocked(getSessionFromHeaders).mockResolvedValue(null as never);
    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({ data: cloneInput() }),
      ErrorCode.UNAUTHORIZED,
    );
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'instructor-1', role: 'instructor' },
      session: {},
    } as never);
    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({
        data: cloneInput({ studentIds: ['student-1', 'student-1'] }),
      }),
      ErrorCode.BAD_REQUEST,
    );
    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({
        data: cloneInput({ finalDeadline: new Date(Date.now() - 1) }),
      }),
      ErrorCode.BAD_REQUEST,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('enforces source lifecycle and individual-mode policy', async () => {
    configureHandlerDb({ sourceStatus: 'draft' });
    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({ data: cloneInput() }),
      ErrorCode.CONFLICT,
    );

    configureHandlerDb({ sourceMode: 'group' });
    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({ data: cloneInput() }),
      ErrorCode.BAD_REQUEST,
    );
  });

  it('rejects unavailable target context and invalid target students atomically', async () => {
    configureHandlerDb({ targetTermStatus: 'closed' });
    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({ data: cloneInput() }),
      ErrorCode.BAD_REQUEST,
    );

    const { inserted } = configureHandlerDb({ activeStudents: [] });
    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({
        data: cloneInput({ studentIds: ['student-1'] }),
      }),
      ErrorCode.BAD_REQUEST,
    );
    expect(inserted.some(({ table }) => table === assignments)).toBe(false);
  });

  it('rejects a missing or inactive target section before writes', async () => {
    configureHandlerDb({ targetRows: [] });
    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({ data: cloneInput() }),
      ErrorCode.FORBIDDEN,
    );

    configureHandlerDb({
      targetRows: [{ id: 30, termStatus: 'active', sectionStatus: 'inactive' }],
    });
    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({ data: cloneInput() }),
      ErrorCode.FORBIDDEN,
    );
  });

  it('maps invalid checkpoint due dates to a bad request', async () => {
    configureHandlerDb({
      templateRows: [
        {
          id: 500,
          name: 'Long checkpoint',
          order: 1,
          minConsultations: 0,
          estimatedDuration: 30,
        },
      ],
    });
    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({
        data: cloneInput({ finalDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000) }),
      }),
      ErrorCode.BAD_REQUEST,
    );
  });

  it('returns an internal error when the clone transaction fails', async () => {
    const { db } = configureHandlerDb();
    vi.mocked(db.transaction).mockRejectedValueOnce(new Error('database failure'));

    expectHandlerError(
      await (cloneAssignmentHandler as HandlerLike)({ data: cloneInput() }),
      ErrorCode.INTERNAL,
    );
  });
});
