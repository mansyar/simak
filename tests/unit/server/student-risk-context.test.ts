/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { getLiveStudentRiskContexts } from '@/server/student-risk-context.server';

function createDb(results: unknown[]) {
  const queue = [...results];
  const query = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    then: vi.fn((onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(queue.shift() ?? []).then(onFulfilled),
    ),
  };

  return {
    select: vi.fn().mockReturnValue(query),
  };
}

describe('getLiveStudentRiskContexts', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;

  it('preserves all five risk signals and their categories', async () => {
    const db = createDb([
      [
        {
          checkpointId: 1,
          checkpointState: 'unlocked',
          dueDate: new Date(now.getTime() - day),
          minConsultations: 0,
          studentId: 'student-1',
          studentName: 'Alice',
          assignmentId: 10,
          assignmentTitle: 'Thesis',
        },
        {
          checkpointId: 2,
          checkpointState: 'unlocked',
          dueDate: new Date(now.getTime() + 2 * day),
          minConsultations: 0,
          studentId: 'student-1',
          studentName: 'Alice',
          assignmentId: 10,
          assignmentTitle: 'Thesis',
        },
        {
          checkpointId: 3,
          checkpointState: 'unlocked',
          dueDate: new Date(now.getTime() + 5 * day),
          minConsultations: 1,
          studentId: 'student-1',
          studentName: 'Alice',
          assignmentId: 10,
          assignmentTitle: 'Thesis',
        },
        {
          checkpointId: 4,
          checkpointState: 'revise',
          dueDate: new Date(now.getTime() + 14 * day),
          minConsultations: 0,
          studentId: 'student-1',
          studentName: 'Alice',
          assignmentId: 10,
          assignmentTitle: 'Thesis',
        },
        {
          checkpointId: 5,
          checkpointState: 'under_review',
          dueDate: new Date(now.getTime() + 14 * day),
          minConsultations: 0,
          studentId: 'student-1',
          studentName: 'Alice',
          assignmentId: 10,
          assignmentTitle: 'Thesis',
        },
      ],
      [],
      [{ checkpointId: 5, count: 1, latestDate: new Date(now.getTime() - 5 * day) }],
      [{ checkpointId: 4, count: 2 }],
    ]);

    const [context] = await getLiveStudentRiskContexts(db as any, {
      assignmentIds: [10],
      now,
    });

    expect(context.assessment.factors.map((factor) => factor.type)).toEqual([
      'overdue_checkpoint',
      'approaching_deadline_no_submission',
      'insufficient_consultations',
      'repeated_revise',
      'stalled_review',
    ]);
    expect(
      context.assessment.factors
        .slice(0, 4)
        .every((factor) => factor.category === 'student_inaction'),
    ).toBe(true);
    expect(context.assessment.factors[4].category).toBe('pending_review');
  });

  it('returns pending_review context without treating it as student inaction', async () => {
    const db = createDb([
      [
        {
          checkpointId: 6,
          checkpointState: 'under_review',
          dueDate: new Date(now.getTime() + 14 * day),
          minConsultations: 0,
          studentId: 'student-2',
          studentName: 'Bob',
          assignmentId: 11,
          assignmentTitle: 'Research Proposal',
        },
      ],
      [],
      [{ checkpointId: 6, count: 1, latestDate: new Date(now.getTime() - 5 * day) }],
      [],
    ]);

    const [context] = await getLiveStudentRiskContexts(db as any, {
      assignmentIds: [11],
      studentId: 'student-2',
      now,
    });

    expect(context.assessment.factors).toHaveLength(1);
    expect(context.assessment.factors[0].category).toBe('pending_review');
    expect(context.assessment.factors[0].type).toBe('stalled_review');
  });
});
