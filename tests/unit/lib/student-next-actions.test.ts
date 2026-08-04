import { describe, expect, it } from 'vitest';
import { resolveStudentNextActions, type StudentActionCandidate } from '@/lib/student-next-actions';

const now = new Date('2026-08-02T12:00:00.000Z');

function candidate(overrides: Partial<StudentActionCandidate>): StudentActionCandidate {
  return {
    assignmentId: 1,
    assignmentTitle: 'Thesis',
    checkpointId: 1,
    checkpointName: 'Proposal',
    state: 'unlocked',
    dueDate: new Date('2026-08-05T12:00:00.000Z'),
    minConsultations: 0,
    verifiedConsultationCount: 0,
    submissionId: null,
    ...overrides,
  };
}

describe('resolveStudentNextActions', () => {
  it('resolves submit, revise, and required-consultation actions with precise destinations', () => {
    const result = resolveStudentNextActions(
      [
        candidate({ checkpointId: 1, checkpointName: 'Submit me' }),
        candidate({
          checkpointId: 2,
          checkpointName: 'Revise me',
          state: 'revise',
          submissionId: 22,
        }),
        candidate({
          checkpointId: 3,
          checkpointName: 'Consult me',
          minConsultations: 2,
          verifiedConsultationCount: 1,
        }),
      ],
      { now },
    );

    expect(result.primaryActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkpointId: 1,
          kind: 'submit',
          href: '/student/assignments/1/checkpoints/1',
        }),
        expect.objectContaining({
          checkpointId: 2,
          kind: 'revise',
          href: '/student/assignments/1/checkpoints/2',
        }),
        expect.objectContaining({
          checkpointId: 3,
          kind: 'consultation',
          href: '/student/assignments/1',
        }),
      ]),
    );
  });

  it('ranks overdue, revise, consultation, next 168 hours, dated, and undated actions', () => {
    const result = resolveStudentNextActions(
      [
        candidate({ checkpointId: 6, dueDate: null }),
        candidate({ checkpointId: 5, dueDate: new Date('2026-09-02T12:00:00.000Z') }),
        candidate({ checkpointId: 4, dueDate: new Date('2026-08-08T12:00:00.000Z') }),
        candidate({
          checkpointId: 3,
          minConsultations: 1,
          verifiedConsultationCount: 0,
          dueDate: new Date('2026-08-20T12:00:00.000Z'),
        }),
        candidate({ checkpointId: 2, state: 'revise' }),
        candidate({ checkpointId: 1, dueDate: new Date('2026-08-01T12:00:00.000Z') }),
      ],
      { now },
    );

    expect(result.primaryActions.map((action) => [action.checkpointId, action.priority])).toEqual([
      [1, 'overdue'],
      [2, 'revise'],
      [3, 'consultation'],
      [4, 'within_168_hours'],
      [5, 'dated'],
    ]);
  });

  it('ranks undated actions after dated actions', () => {
    const result = resolveStudentNextActions(
      [
        candidate({ checkpointId: 2, dueDate: null }),
        candidate({ checkpointId: 1, dueDate: new Date('2026-09-02T12:00:00.000Z') }),
      ],
      { now },
    );

    expect(result.primaryActions.map((action) => [action.checkpointId, action.priority])).toEqual([
      [1, 'dated'],
      [2, 'undated'],
    ]);
  });

  it('uses the highest-priority signal once per checkpoint', () => {
    const result = resolveStudentNextActions(
      [
        candidate({
          checkpointId: 10,
          state: 'revise',
          minConsultations: 2,
          verifiedConsultationCount: 0,
        }),
      ],
      { now },
    );

    expect(result.primaryActions).toHaveLength(1);
    expect(result.primaryActions[0]).toMatchObject({
      checkpointId: 10,
      kind: 'revise',
      priority: 'revise',
    });
  });

  it('adds only unresolved current-plan items to a revise action', () => {
    const result = resolveStudentNextActions(
      [
        candidate({
          state: 'revise',
          revisionActionItems: [
            { itemText: 'Rewrite the conclusion', addressedAt: null },
            { itemText: 'Already addressed', addressedAt: new Date('2026-08-01') },
            { itemText: 'Add evidence', addressedAt: null },
          ],
        } as any),
      ],
      { now },
    );

    expect(result.primaryActions[0]).toMatchObject({
      kind: 'revise',
      revisionActionPlan: {
        unresolvedCount: 2,
        items: ['Rewrite the conclusion', 'Add evidence'],
      },
    });
  });

  it('preserves the existing revise action contract when there is no unresolved plan', () => {
    const result = resolveStudentNextActions(
      [
        candidate({
          state: 'revise',
          revisionActionItems: [
            { itemText: 'Already addressed', addressedAt: new Date('2026-08-01') },
          ],
        } as any),
        candidate({
          checkpointId: 2,
          state: 'submitted',
          revisionActionItems: [{ itemText: 'Waiting item', addressedAt: null }],
        } as any),
      ],
      { now },
    );

    expect(result.primaryActions[0]).toMatchObject({ kind: 'revise' });
    expect(result.primaryActions[0]).not.toHaveProperty('revisionActionPlan');
    expect(result.waitingSummary.submitted.representatives[0]).not.toHaveProperty(
      'revisionActionPlan',
    );
  });

  it('tie-breaks by due date and stable assignment/checkpoint identifiers', () => {
    const dueDate = new Date('2026-08-04T12:00:00.000Z');
    const result = resolveStudentNextActions(
      [
        candidate({ assignmentId: 2, checkpointId: 20, dueDate }),
        candidate({ assignmentId: 1, checkpointId: 30, dueDate }),
        candidate({ assignmentId: 1, checkpointId: 10, dueDate }),
      ],
      { now },
    );

    expect(
      result.primaryActions.map((action) => [action.assignmentId, action.checkpointId]),
    ).toEqual([
      [1, 10],
      [1, 30],
      [2, 20],
    ]);
  });

  it('loads all candidates before applying the five-action limit', () => {
    const candidates = Array.from({ length: 5 }, (_, index) =>
      candidate({
        assignmentId: index + 1,
        checkpointId: index + 1,
        dueDate: new Date('2026-09-01T12:00:00.000Z'),
      }),
    );
    candidates.push(
      candidate({
        assignmentId: 99,
        checkpointId: 99,
        dueDate: new Date('2026-08-01T12:00:00.000Z'),
      }),
    );

    const result = resolveStudentNextActions(candidates, { now });

    expect(result.primaryActions).toHaveLength(5);
    expect(result.primaryActions[0]).toMatchObject({ assignmentId: 99, checkpointId: 99 });
  });

  it('excludes locked and passed checkpoints from primary actions', () => {
    const result = resolveStudentNextActions(
      [
        candidate({ checkpointId: 1, state: 'locked' }),
        candidate({ checkpointId: 2, state: 'passed' }),
      ],
      { now },
    );

    expect(result.primaryActions).toEqual([]);
    expect(result.waitingSummary).toEqual({
      submitted: { count: 0, representatives: [] },
      underReview: { count: 0, representatives: [] },
    });
  });

  it('groups all submitted and under-review work, including older items, with three total representatives', () => {
    const result = resolveStudentNextActions(
      [
        candidate({
          assignmentId: 1,
          checkpointId: 11,
          state: 'submitted',
          dueDate: new Date('2026-07-01T12:00:00.000Z'),
          submissionId: 101,
        }),
        candidate({
          assignmentId: 2,
          checkpointId: 22,
          state: 'submitted',
          dueDate: new Date('2026-07-02T12:00:00.000Z'),
          submissionId: 102,
        }),
        candidate({
          assignmentId: 3,
          checkpointId: 33,
          state: 'under_review',
          dueDate: new Date('2026-06-01T12:00:00.000Z'),
          submissionId: 103,
        }),
        candidate({
          assignmentId: 4,
          checkpointId: 44,
          state: 'under_review',
          dueDate: new Date('2026-05-01T12:00:00.000Z'),
          submissionId: 104,
        }),
      ],
      { now },
    );

    expect(result.primaryActions).toEqual([]);
    expect(result.waitingSummary.submitted.count).toBe(2);
    expect(result.waitingSummary.underReview.count).toBe(2);
    expect(result.waitingSummary.submitted.representatives.length).toBeGreaterThan(0);
    expect(result.waitingSummary.underReview.representatives.length).toBeGreaterThan(0);
    expect(
      result.waitingSummary.submitted.representatives.length +
        result.waitingSummary.underReview.representatives.length,
    ).toBeLessThanOrEqual(3);
    expect(result.waitingSummary.underReview.representatives).toEqual(
      expect.arrayContaining([expect.objectContaining({ checkpointId: 44 })]),
    );
  });
});
