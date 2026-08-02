/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStudentDashboardDataHandler } from '@/server/dashboard-student.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

const studentSession = {
  user: { id: 'student-1', role: 'student' as const },
  session: {} as any,
};

function createMockDb(sequence: unknown[]) {
  const builder: any = {
    select: vi.fn(() => builder),
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    then: vi.fn((onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(sequence.shift() ?? []).then(onFulfilled),
    ),
  };

  return builder;
}

describe('getStudentDashboardDataHandler — student next actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated and non-student sessions', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValueOnce(null);
    expect(await getStudentDashboardDataHandler()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValueOnce({
      user: { id: 'instructor-1', role: 'instructor' },
      session: {},
    } as any);
    expect(await getStudentDashboardDataHandler()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
  });

  it('returns complete prioritized actions, waiting groups, and existing widget data', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const now = Date.now();
    const mockDb = createMockDb([
      [
        {
          id: 1,
          title: 'Thesis',
          finalDeadline: new Date(now + 30 * 24 * 60 * 60 * 1000),
          templateName: 'Thesis Template',
          templateType: 'thesis',
        },
      ],
      [
        {
          assignmentId: 1,
          assignmentTitle: 'Thesis',
          checkpointId: 201,
          checkpointName: 'Dated one',
          dueDate: new Date(now + 30 * 24 * 60 * 60 * 1000),
          state: 'unlocked',
          minConsultations: 0,
        },
        {
          assignmentId: 1,
          assignmentTitle: 'Thesis',
          checkpointId: 202,
          checkpointName: 'Revise one',
          dueDate: new Date(now + 10 * 24 * 60 * 60 * 1000),
          state: 'revise',
          minConsultations: 0,
        },
        {
          assignmentId: 1,
          assignmentTitle: 'Thesis',
          checkpointId: 203,
          checkpointName: 'Consult one',
          dueDate: new Date(now + 20 * 24 * 60 * 60 * 1000),
          state: 'unlocked',
          minConsultations: 2,
        },
        {
          assignmentId: 1,
          assignmentTitle: 'Thesis',
          checkpointId: 204,
          checkpointName: 'Dated two',
          dueDate: new Date(now + 31 * 24 * 60 * 60 * 1000),
          state: 'unlocked',
          minConsultations: 0,
        },
        {
          assignmentId: 1,
          assignmentTitle: 'Thesis',
          checkpointId: 205,
          checkpointName: 'Dated three',
          dueDate: new Date(now + 32 * 24 * 60 * 60 * 1000),
          state: 'unlocked',
          minConsultations: 0,
        },
        {
          assignmentId: 1,
          assignmentTitle: 'Thesis',
          checkpointId: 206,
          checkpointName: 'Urgent one',
          dueDate: new Date(now - 24 * 60 * 60 * 1000),
          state: 'unlocked',
          minConsultations: 0,
        },
        {
          assignmentId: 1,
          assignmentTitle: 'Thesis',
          checkpointId: 207,
          checkpointName: 'Submitted one',
          dueDate: new Date(now - 40 * 24 * 60 * 60 * 1000),
          state: 'submitted',
          minConsultations: 0,
        },
        {
          assignmentId: 1,
          assignmentTitle: 'Thesis',
          checkpointId: 208,
          checkpointName: 'Review one',
          dueDate: new Date(now - 45 * 24 * 60 * 60 * 1000),
          state: 'under_review',
          minConsultations: 0,
        },
      ],
      [
        {
          submissionId: 900,
          assignmentTitle: 'Thesis',
          checkpointName: 'Review one',
          submittedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
      ],
      [
        {
          assignmentId: 1,
          checkpointId: 203,
          assignmentTitle: 'Thesis',
          checkpointName: 'Consult one',
          consultationDate: new Date(now - 3 * 24 * 60 * 60 * 1000),
          consultationId: 901,
          status: 'verified',
        },
        {
          assignmentId: 1,
          checkpointId: 207,
          assignmentTitle: 'Thesis',
          checkpointName: 'Submitted one',
          consultationDate: new Date(now - 1 * 24 * 60 * 60 * 1000),
          consultationId: 902,
          status: 'pending',
        },
      ],
      [
        {
          assignmentId: 1,
          name: 'Dated one',
          order: 1,
          state: 'unlocked',
          dueDate: new Date(now + 30 * 24 * 60 * 60 * 1000),
        },
      ],
    ]);
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);

    const result = (await getStudentDashboardDataHandler()) as any;

    expect(result.nextActions.primaryActions).toHaveLength(5);
    expect(result.nextActions.primaryActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkpointId: 206, priority: 'overdue' }),
        expect.objectContaining({ checkpointId: 202, kind: 'revise' }),
        expect.objectContaining({ checkpointId: 203, kind: 'consultation' }),
      ]),
    );
    expect(result.nextActions.primaryActions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ checkpointId: 207 })]),
    );
    expect(result.nextActions.waitingSummary).toMatchObject({
      submitted: { count: 1 },
      underReview: { count: 1 },
    });
    expect(result.nextActions.waitingSummary.submitted.representatives[0]).toMatchObject({
      assignmentId: 1,
      checkpointId: 207,
      href: '/student/assignments/1/checkpoints/207',
    });
    expect(result.nextActions.waitingSummary.underReview.representatives[0]).toMatchObject({
      assignmentId: 1,
      checkpointId: 208,
      href: '/student/assignments/1/checkpoints/208',
    });

    expect(result.pendingReviews).toHaveLength(1);
    expect(result.pendingReviews[0].submissionId).toBe(900);
    expect(result.consultationReminders).toHaveLength(1);
    expect(result.consultationReminders[0].consultationId).toBe(902);
    expect(result.activeAssignments).toHaveLength(1);
  });

  it('returns empty next-actions structures without changing the existing empty response fields', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    vi.mocked(dbMod.getDb).mockReturnValue(createMockDb([[], [], [], []]) as any);

    const result = (await getStudentDashboardDataHandler()) as any;

    expect(result.activeAssignments).toEqual([]);
    expect(result.upcomingDeadlines).toEqual([]);
    expect(result.pendingReviews).toEqual([]);
    expect(result.consultationReminders).toEqual([]);
    expect(result.nextActions).toEqual({
      primaryActions: [],
      waitingSummary: {
        submitted: { count: 0, representatives: [] },
        underReview: { count: 0, representatives: [] },
      },
    });
  });
});
