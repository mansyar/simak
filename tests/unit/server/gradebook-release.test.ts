/** @vitest-environment node */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  PreflightGradeReleaseSchema,
  PublishGradeReleaseSchema,
  WithdrawGradeReleaseSchema,
} from '@/server/gradebook';
import { getStudentFinalGradeHandler } from '@/server/gradebook.server';
import {
  getGradeReleasePreflightHandler,
  publishGradeReleaseHandler,
  withdrawGradeReleaseHandler,
} from '@/server/gradebook-extras.server';
import { isServerError } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as audit from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
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

const ownerSession = {
  user: { id: 'instructor-1', name: 'Instructor', role: 'instructor' as const },
  session: {} as any,
};

const otherInstructorSession = {
  user: { id: 'instructor-2', name: 'Other Instructor', role: 'instructor' as const },
  session: {} as any,
};

const studentSession = {
  user: { id: 'student-1', name: 'Student', role: 'student' as const },
  session: {} as any,
};

const adminSession = {
  user: { id: 'admin-1', name: 'Admin', role: 'admin' as const },
  session: {} as any,
};

const superadminSession = {
  user: { id: 'superadmin-1', name: 'Superadmin', role: 'superadmin' as const },
  session: {} as any,
};

type MockResult = unknown[] | { reject: Error };

function createMockDb() {
  const results: MockResult[] = [];

  const createChain = () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any, onrejected: any) => {
        const result = results.shift() ?? [];
        if ('reject' in result) return Promise.reject(result.reject).then(onfulfilled, onrejected);
        return Promise.resolve(result).then(onfulfilled, onrejected);
      }),
    };
    return chain;
  };

  const db = createChain();
  const tx = createChain();
  db.transaction = vi.fn(async (callback: (transaction: any) => Promise<unknown>) => callback(tx));

  return {
    db,
    tx,
    enqueue: (...items: MockResult[]) => results.push(...items),
    clearQueue: () => results.splice(0),
  };
}

const assignment = { id: 1, instructorId: 'instructor-1' };
const draftConfig = {
  releaseStatus: 'draft',
  activeReleaseVersion: null,
  publishedAt: null,
};

const eligibleGrade = {
  studentId: 'student-complete',
  studentName: 'Complete Student',
  numericScore: '92.50',
  letterGrade: 'A',
  status: 'complete',
  contributingCheckpoints: [{ checkpointId: 10, score: 92.5 }],
};

const incompleteGrade = {
  studentId: 'student-incomplete',
  studentName: 'Incomplete Student',
  numericScore: null,
  letterGrade: null,
  status: 'in_progress',
  contributingCheckpoints: [],
};

const missingGrade = {
  studentId: 'student-missing',
  studentName: 'Missing Student',
  numericScore: null,
  letterGrade: null,
  status: null,
  contributingCheckpoints: null,
};

describe('grade release server contracts', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mock.db as any);
    vi.mocked(audit.logAuditEvent).mockResolvedValue(undefined);
  });

  describe('input schemas', () => {
    it('requires a positive assignment id for preflight', () => {
      expect(PreflightGradeReleaseSchema.safeParse({ assignmentId: 1 }).success).toBe(true);
      expect(PreflightGradeReleaseSchema.safeParse({ assignmentId: 0 }).success).toBe(false);
    });

    it('requires explicit confirmation for publication', () => {
      expect(
        PublishGradeReleaseSchema.safeParse({ assignmentId: 1, confirmed: true }).success,
      ).toBe(true);
      expect(
        PublishGradeReleaseSchema.safeParse({ assignmentId: 1, confirmed: false }).success,
      ).toBe(false);
    });

    it('requires a non-empty withdrawal reason', () => {
      expect(WithdrawGradeReleaseSchema.safeParse({ assignmentId: 1, reason: '  ' }).success).toBe(
        false,
      );
      expect(
        WithdrawGradeReleaseSchema.safeParse({ assignmentId: 1, reason: 'Correction required' })
          .success,
      ).toBe(true);
    });
  });

  it('classifies eligible, incomplete, and missing persisted grades in preflight', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(ownerSession as any);
    mock.enqueue([assignment], [draftConfig], [eligibleGrade, incompleteGrade, missingGrade]);

    const result = (await getGradeReleasePreflightHandler({ data: { assignmentId: 1 } })) as any;

    expect(result.counts).toEqual({ eligible: 1, incomplete: 1, missing: 1 });
    expect(result.eligible).toEqual([expect.objectContaining({ studentId: 'student-complete' })]);
    expect(result.incomplete).toEqual([
      expect.objectContaining({ studentId: 'student-incomplete', status: 'in_progress' }),
    ]);
    expect(result.missing).toEqual([expect.objectContaining({ studentId: 'student-missing' })]);
  });

  it.each([
    ['student', studentSession],
    ['admin', adminSession],
    ['superadmin', superadminSession],
  ])('rejects %s from publishing and withdrawing', async (_role, session) => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(session as any);

    const publishResult = await publishGradeReleaseHandler({
      data: { assignmentId: 1, confirmed: true },
    });
    const withdrawResult = await withdrawGradeReleaseHandler({
      data: { assignmentId: 1, reason: 'Correction required' },
    });

    expect(isServerError(publishResult)).toBe(true);
    expect(isServerError(withdrawResult)).toBe(true);
    expect(mock.db.transaction).not.toHaveBeenCalled();
  });

  it('rejects non-students from the student-facing grade endpoint', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    const result = await getStudentFinalGradeHandler({ data: { assignmentId: 1 } });

    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
    expect(mock.db.select).not.toHaveBeenCalled();
  });

  it('rejects a non-owning instructor from publishing or withdrawing', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(otherInstructorSession as any);
    mock.enqueue([]);

    const publishResult = await publishGradeReleaseHandler({
      data: { assignmentId: 1, confirmed: true },
    });
    mock.clearQueue();
    mock.enqueue([]);
    const withdrawResult = await withdrawGradeReleaseHandler({
      data: { assignmentId: 1, reason: 'Correction required' },
    });

    expect(isServerError(publishResult)).toBe(true);
    expect(isServerError(withdrawResult)).toBe(true);
  });

  it('publishes only eligible students and updates release state atomically', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(ownerSession as any);
    mock.enqueue(
      [assignment],
      [draftConfig],
      [eligibleGrade, incompleteGrade, missingGrade],
      [],
      [],
    );

    const result = (await publishGradeReleaseHandler({
      data: { assignmentId: 1, confirmed: true },
    })) as any;

    expect(result).toEqual(
      expect.objectContaining({ success: true, releaseVersion: 1, publishedCount: 1 }),
    );
    expect(mock.db.transaction).toHaveBeenCalledTimes(1);
    expect(mock.tx.values).toHaveBeenCalledWith([
      expect.objectContaining({
        assignmentId: 1,
        studentId: 'student-complete',
        releaseVersion: 1,
        numericScore: '92.50',
        letterGrade: 'A',
        status: 'complete',
      }),
    ]);
    expect(mock.tx.set).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseStatus: 'published',
        activeReleaseVersion: 1,
      }),
    );
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'instructor-1',
        action: 'gradebook.release_published',
        entityId: '1',
        details: expect.objectContaining({ releaseVersion: 1, publishedCount: 1 }),
      }),
    );
  });

  it('does not partially publish when the snapshot transaction fails', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(ownerSession as any);
    mock.enqueue([assignment], [draftConfig], [eligibleGrade], {
      reject: new Error('snapshot insert failed'),
    });

    const result = await publishGradeReleaseHandler({
      data: { assignmentId: 1, confirmed: true },
    });

    expect(isServerError(result)).toBe(true);
    expect(mock.tx.insert).toHaveBeenCalled();
    expect(mock.tx.update).not.toHaveBeenCalled();
    expect(audit.logAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects publication while another release is active', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(ownerSession as any);
    mock.enqueue(
      [assignment],
      [{ releaseStatus: 'published', activeReleaseVersion: 1, publishedAt: new Date() }],
    );

    const result = await publishGradeReleaseHandler({
      data: { assignmentId: 1, confirmed: true },
    });

    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('CONFLICT');
    expect(mock.tx.insert).not.toHaveBeenCalled();
  });

  it('withdraws a published release with a reason and retains prior snapshots', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(ownerSession as any);
    mock.enqueue(
      [assignment],
      [{ releaseStatus: 'published', activeReleaseVersion: 3, publishedAt: new Date() }],
      [],
    );

    const result = await withdrawGradeReleaseHandler({
      data: { assignmentId: 1, reason: 'Corrected final grade calculation' },
    });

    expect(result).toEqual({ success: true });
    expect(mock.tx.update).toHaveBeenCalledTimes(1);
    const update = mock.tx.set.mock.calls[0][0];
    expect(update).toEqual(expect.objectContaining({ releaseStatus: 'draft', publishedAt: null }));
    expect(update).not.toHaveProperty('activeReleaseVersion');
    expect(mock.tx.delete).not.toHaveBeenCalled();
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'gradebook.release_withdrawn',
        details: expect.objectContaining({
          releaseVersion: 3,
          reason: 'Corrected final grade calculation',
        }),
      }),
    );
  });

  it('requires a non-empty withdrawal reason at the handler boundary', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(ownerSession as any);

    const result = await withdrawGradeReleaseHandler({
      data: { assignmentId: 1, reason: '   ' },
    });

    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('VALIDATION');
    expect(mock.db.transaction).not.toHaveBeenCalled();
  });

  it('republishing after withdrawal creates a new version and keeps the old version', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(ownerSession as any);
    mock.enqueue(
      [assignment],
      [{ releaseStatus: 'published', activeReleaseVersion: 3, publishedAt: new Date() }],
      [],
      [assignment],
      [{ ...draftConfig, activeReleaseVersion: 3 }],
      [eligibleGrade],
      [],
      [],
    );

    await withdrawGradeReleaseHandler({
      data: { assignmentId: 1, reason: 'Corrected final grade calculation' },
    });
    const result = (await publishGradeReleaseHandler({
      data: { assignmentId: 1, confirmed: true },
    })) as any;

    expect(result.releaseVersion).toBe(4);
    expect(mock.tx.values).toHaveBeenCalledWith([
      expect.objectContaining({ releaseVersion: 4, studentId: 'student-complete' }),
    ]);
  });
});

describe('student grade release visibility', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mock.db as any);
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
  });

  it('hides provisional grades while the assignment is draft', async () => {
    mock.enqueue(
      [{ assignmentId: 1 }],
      [
        {
          releaseStatus: 'draft',
          activeReleaseVersion: null,
          publishedAt: null,
        },
      ],
    );

    const result = await getStudentFinalGradeHandler({ data: { assignmentId: 1 } });

    expect(result).toEqual({ available: false, reason: 'not_yet_released' });
  });

  it('returns the active immutable snapshot rather than live final-grade data', async () => {
    const publishedAt = new Date('2026-08-02T12:00:00Z');
    mock.enqueue(
      [{ assignmentId: 1 }],
      [{ releaseStatus: 'published', activeReleaseVersion: 2, publishedAt }],
      [
        {
          releaseVersion: 2,
          numericScore: '92.50',
          letterGrade: 'A',
          status: 'complete',
          contributingCheckpoints: [
            {
              checkpointId: 10,
              checkpointName: 'Checkpoint 10',
              templateCheckpointId: 100,
              order: 1,
              state: 'passed',
              score: 92.5,
              isRubric: false,
              weight: 100,
            },
          ],
          publishedAt,
        },
      ],
    );

    const result = (await getStudentFinalGradeHandler({ data: { assignmentId: 1 } })) as any;

    expect(result).toEqual({
      available: true,
      releaseVersion: 2,
      numericScore: 92.5,
      letterGrade: 'A',
      status: 'complete',
      contributingCheckpoints: [
        {
          checkpointId: 10,
          checkpointName: 'Checkpoint 10',
          templateCheckpointId: 100,
          order: 1,
          state: 'passed',
          score: 92.5,
          isRubric: false,
          weight: 100,
        },
      ],
      publishedAt,
    });
  });

  it('keeps students unavailable when they have no snapshot in the active release', async () => {
    mock.enqueue(
      [{ assignmentId: 1 }],
      [{ releaseStatus: 'published', activeReleaseVersion: 2, publishedAt: new Date() }],
      [],
    );

    const result = await getStudentFinalGradeHandler({ data: { assignmentId: 1 } });

    expect(result).toEqual({ available: false, reason: 'not_yet_released' });
  });
});
