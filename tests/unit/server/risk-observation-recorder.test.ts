/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { safeAuditLog } from '@/lib/audit';
import { RISK_ALGORITHM_VERSION } from '@/lib/risk-scoring';
import { recordRiskObservation } from '@/server/risk-observation-recorder.server';
import { getLiveStudentRiskContexts } from '@/server/student-risk-context.server';

vi.mock('@/lib/audit', () => ({ safeAuditLog: vi.fn() }));
vi.mock('@/server/student-risk-context.server', () => ({ getLiveStudentRiskContexts: vi.fn() }));

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    then: vi.fn(function (
      this: any,
      onfulfilled: (value: unknown) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve([]).then(onfulfilled, onrejected);
    }),
  };
}

function queueResults(mockDb: ReturnType<typeof createMockDb>, ...results: unknown[]) {
  for (const result of results) {
    mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve(result).then(onfulfilled),
    );
  }
}

const observedAt = new Date('2026-08-10T10:00:00.000Z');
const input = {
  source: 'lifecycle_event' as const,
  eventType: 'review_recorded' as const,
  sourceEventId: 'review:42',
  assignmentId: 12,
  studentId: 'student-1',
  checkpointId: 8,
  actorId: 'instructor-1',
  observedAt,
};

function liveContext() {
  return {
    studentId: input.studentId,
    assignmentId: input.assignmentId,
    studentName: 'Private Student Name',
    assignmentTitle: 'Private Assignment Title',
    checkpoints: [{ checkpointId: 8, submissionCount: 0 }],
    assessment: {
      level: 'high' as const,
      factors: [
        {
          type: 'overdue_checkpoint' as const,
          category: 'student_inaction' as const,
          severity: 'high' as const,
          checkpointId: 8,
          description: 'Private description',
        },
        {
          type: 'repeated_revise' as const,
          category: 'student_inaction' as const,
          severity: 'medium' as const,
          checkpointId: 8,
          description: 'Private description two',
        },
      ],
    },
  };
}

describe('recordRiskObservation', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getLiveStudentRiskContexts).mockResolvedValue([liveContext()] as any);
  });

  it('stores a deterministic, allow-listed immutable snapshot with academic context', async () => {
    queueResults(mockDb, [{ sectionId: 3, courseId: 4, academicTermId: 5 }], [{ id: 99 }]);

    await expect(recordRiskObservation(mockDb as any, input)).resolves.toEqual({
      created: true,
      observationId: 99,
    });

    expect(getLiveStudentRiskContexts).toHaveBeenCalledWith(mockDb, {
      assignmentIds: [12],
      studentId: 'student-1',
      now: observedAt,
    });
    expect(mockDb.values).toHaveBeenCalledWith({
      source: 'lifecycle_event',
      eventType: 'review_recorded',
      sourceEventId: 'review:42',
      idempotencyKey: 'risk-observation:review_recorded:review:42:12:student-1',
      assignmentId: 12,
      studentId: 'student-1',
      checkpointId: 8,
      interventionId: null,
      sectionId: 3,
      courseId: 4,
      academicTermId: 5,
      observedAt,
      algorithmVersion: RISK_ALGORITHM_VERSION,
      riskLevel: 'high',
      factorSnapshot: [
        { code: 'overdue_checkpoint', category: 'student_inaction', severity: 'high' },
        { code: 'repeated_revise', category: 'student_inaction', severity: 'medium' },
      ],
      explanationSnapshot: {
        version: 'risk-observation-explanation-v1',
        factorCodes: ['overdue_checkpoint', 'repeated_revise'],
      },
    });
    expect(mockDb.onConflictDoNothing).toHaveBeenCalledTimes(1);
    expect(mockDb).not.toHaveProperty('update');
    expect(mockDb).not.toHaveProperty('delete');
  });

  it('treats an idempotent retry as a successful no-op without a duplicate audit event', async () => {
    queueResults(mockDb, [{ sectionId: 3, courseId: 4, academicTermId: 5 }], []);

    await expect(recordRiskObservation(mockDb as any, input)).resolves.toEqual({ created: false });

    expect(safeAuditLog).not.toHaveBeenCalled();
  });

  it('audits only a successful capture without private snapshot data', async () => {
    queueResults(mockDb, [{ sectionId: 3, courseId: 4, academicTermId: 5 }], [{ id: 99 }]);

    await recordRiskObservation(mockDb as any, input);

    expect(safeAuditLog).toHaveBeenCalledWith('risk_observation.recorded', {
      actorId: 'instructor-1',
      action: 'risk_observation.recorded',
      entityType: 'risk_observation',
      entityId: '99',
      details: {
        assignmentId: 12,
        studentId: 'student-1',
        source: 'lifecycle_event',
        eventType: 'review_recorded',
      },
    });
  });

  it('rejects missing academic context before inserting', async () => {
    queueResults(mockDb, []);

    await expect(recordRiskObservation(mockDb as any, input)).rejects.toThrow(
      'Risk observation assignment context not found',
    );
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('records a low-risk empty snapshot when no active risk context remains', async () => {
    queueResults(mockDb, [{ sectionId: 3, courseId: 4, academicTermId: 5 }], [{ id: 100 }]);
    vi.mocked(getLiveStudentRiskContexts).mockResolvedValue([]);

    await expect(recordRiskObservation(mockDb as any, input)).resolves.toEqual({
      created: true,
      observationId: 100,
    });
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        riskLevel: 'low',
        factorSnapshot: [],
        explanationSnapshot: {
          version: 'risk-observation-explanation-v1',
          factorCodes: [],
        },
      }),
    );
  });

  it('propagates storage failures and does not write a success audit event', async () => {
    queueResults(mockDb, [{ sectionId: 3, courseId: 4, academicTermId: 5 }]);
    mockDb.then.mockImplementationOnce(
      (_onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) => {
        onrejected?.(new Error('storage unavailable'));
        return Promise.resolve();
      },
    );

    await expect(recordRiskObservation(mockDb as any, input)).rejects.toThrow(
      'storage unavailable',
    );
    expect(safeAuditLog).not.toHaveBeenCalled();
  });
});
