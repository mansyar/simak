/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndFireRiskAlert } from '@/lib/risk-alerts';
import { computeStudentRisk } from '@/lib/risk-scoring';
import { sendStudentAtRiskEmail } from '@/lib/at-risk-email';
import { logger } from '@/lib/logger';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/risk-scoring', () => ({
  computeStudentRisk: vi.fn(),
}));

vi.mock('@/lib/at-risk-email', () => ({
  sendStudentAtRiskEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/i18n-server', () => ({
  getNotificationKeys: vi.fn().mockReturnValue({
    titleKey: 'notifications.events.student_at_risk.title',
    messageKey: 'notifications.events.student_at_risk.message',
  }),
}));

describe('checkAndFireRiskAlert', () => {
  let mockDb: any;

  const baseOpts = {
    studentId: 'student-1',
    studentName: 'Alice',
    assignmentId: 10,
    assignmentTitle: 'Thesis',
    instructorId: 'instructor-1',
  };

  const checkpointRows = [
    {
      checkpointId: 1,
      state: 'unlocked',
      dueDate: new Date('2026-07-20T00:00:00Z'),
      minConsultations: 1,
      order: 1,
    },
  ];

  const highRiskAssessment = {
    level: 'high' as const,
    factors: [
      {
        type: 'overdue_checkpoint' as const,
        severity: 'high' as const,
        category: 'student_inaction' as const,
        checkpointId: 1,
        description: 'Checkpoint is overdue',
      },
    ],
  };

  const mediumRiskAssessment = {
    level: 'medium' as const,
    factors: [
      {
        type: 'approaching_deadline_no_submission' as const,
        severity: 'medium' as const,
        category: 'student_inaction' as const,
        checkpointId: 1,
        description: 'Deadline approaching with no submission',
      },
    ],
  };

  const lowRiskAssessment = {
    level: 'low' as const,
    factors: [
      {
        type: 'stalled_review' as const,
        severity: 'low' as const,
        category: 'pending_review' as const,
        checkpointId: 1,
        description: 'Review stalled beyond SLA',
      },
    ],
  };

  const noRiskAssessment = {
    level: 'low' as const,
    factors: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      then: vi.fn(),
    };
  });

  function queueThen(db: any, result: any) {
    db.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve(result).then(onfulfilled));
  }

  function queueStandardQueries(opts?: { dedupResult?: any[] }) {
    // Q1: checkpoints query
    queueThen(mockDb, checkpointRows);
    // Q2: consultations aggregate
    queueThen(mockDb, []);
    // Q3: submissions aggregate
    queueThen(mockDb, []);
    // Q4: reviews aggregate
    queueThen(mockDb, []);
    // Q5: dedup query
    queueThen(mockDb, opts?.dedupResult ?? []);
  }

  it('should fire alert when risk is high', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(sendStudentAtRiskEmail).toHaveBeenCalledTimes(1);
  });

  it('should fire alert when risk is medium', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(mediumRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(sendStudentAtRiskEmail).toHaveBeenCalledTimes(1);
  });

  it('should skip when risk is low', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(lowRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(sendStudentAtRiskEmail).not.toHaveBeenCalled();
  });

  it('should skip when no risk factors', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(noRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(sendStudentAtRiskEmail).not.toHaveBeenCalled();
  });

  it('should skip when no checkpoints found', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    // Q1: empty checkpoints
    queueThen(mockDb, []);

    await checkAndFireRiskAlert(mockDb, baseOpts);

    // No aggregate queries, no dedup, no insert, no email
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(sendStudentAtRiskEmail).not.toHaveBeenCalled();
    // computeStudentRisk should not be called
    expect(computeStudentRisk).not.toHaveBeenCalled();
  });

  it('should skip when dedup exists (notification in last 7 days)', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries({ dedupResult: [{ id: 999 }] });

    await checkAndFireRiskAlert(mockDb, baseOpts);

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(sendStudentAtRiskEmail).not.toHaveBeenCalled();
  });

  it('should fire when no dedup exists', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries({ dedupResult: [] });

    await checkAndFireRiskAlert(mockDb, baseOpts);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(sendStudentAtRiskEmail).toHaveBeenCalledTimes(1);
  });

  it('should catch DB error without throwing (advisory)', async () => {
    const dbError = new Error('Connection failed');
    mockDb.then.mockImplementation((_onfulfilled: any, onrejected: any) => {
      onrejected(dbError);
    });

    await expect(checkAndFireRiskAlert(mockDb, baseOpts)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'advisory_failed',
        handler: 'checkAndFireRiskAlert',
      }),
    );
  });

  it('should use Promise.allSettled so email failure does not block notification insert', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries();

    // Make email reject
    vi.mocked(sendStudentAtRiskEmail).mockRejectedValueOnce(new Error('Email failed'));

    // Should not throw — allSettled handles rejections
    await expect(checkAndFireRiskAlert(mockDb, baseOpts)).resolves.toBeUndefined();

    // Notification insert should still have been called
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    // Email should have been attempted
    expect(sendStudentAtRiskEmail).toHaveBeenCalledTimes(1);
  });

  it('should target instructor with notification (userId = instructorId)', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(valuesArg.userId).toBe('instructor-1');
  });

  it('should set notification type to student_at_risk', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(valuesArg.type).toBe('student_at_risk');
  });

  it('should set notification channel to in_app', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(valuesArg.channel).toBe('in_app');
  });

  it('should include correct titleKey and messageKey', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(valuesArg.titleKey).toBe('notifications.events.student_at_risk.title');
    expect(valuesArg.messageKey).toBe('notifications.events.student_at_risk.message');
  });

  it('should include correct params in notification', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(valuesArg.params).toEqual({
      studentName: 'Alice',
      assignmentTitle: 'Thesis',
      riskLevel: 'high',
      riskFactors: 'Checkpoint is overdue',
    });
  });

  it('should include correct metadata in notification', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(valuesArg.metadata).toEqual({
      assignmentId: 10,
      studentId: 'student-1',
      riskLevel: 'high',
      factors: highRiskAssessment.factors,
    });
  });

  it('should call sendStudentAtRiskEmail with instructor as recipient', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    expect(sendStudentAtRiskEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendStudentAtRiskEmail).mock.calls[0][0];
    expect(call.recipientId).toBe('instructor-1');
    expect(call.studentName).toBe('Alice');
    expect(call.assignmentTitle).toBe('Thesis');
    expect(call.assignmentId).toBe(10);
  });

  it('should include risk level and factors in email params', async () => {
    vi.mocked(computeStudentRisk).mockReturnValue(highRiskAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    const call = vi.mocked(sendStudentAtRiskEmail).mock.calls[0][0];
    expect(call.riskLevel).toBe('high');
    expect(call.riskFactors).toBe('Checkpoint is overdue');
  });

  it('should join multiple factor descriptions with comma', async () => {
    const multiFactorAssessment = {
      level: 'high' as const,
      factors: [
        {
          type: 'overdue_checkpoint' as const,
          severity: 'high' as const,
          category: 'student_inaction' as const,
          checkpointId: 1,
          description: 'Overdue',
        },
        {
          type: 'repeated_revise' as const,
          severity: 'medium' as const,
          category: 'student_inaction' as const,
          checkpointId: 1,
          description: 'Repeated revise',
        },
      ],
    };
    vi.mocked(computeStudentRisk).mockReturnValue(multiFactorAssessment);
    queueStandardQueries();

    await checkAndFireRiskAlert(mockDb, baseOpts);

    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(valuesArg.params.riskFactors).toBe('Overdue, Repeated revise');
  });
});
