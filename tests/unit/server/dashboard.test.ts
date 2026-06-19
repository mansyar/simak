/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GetStudentDashboardDataSchema,
  GetInstructorDashboardDataSchema,
  GetAdminDashboardDataSchema,
  getStudentDashboardData,
  getInstructorDashboardData,
  getAdminDashboardData,
} from '@/server/dashboard';
import {
  getStudentDashboardDataHandler,
  getInstructorDashboardDataHandler,
  getAdminDashboardDataHandler,
} from '@/server/dashboard.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Schema validation tests
describe('Dashboard schemas', () => {
  describe('GetStudentDashboardDataSchema', () => {
    it('should accept empty input', () => {
      const result = GetStudentDashboardDataSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('GetInstructorDashboardDataSchema', () => {
    it('should accept empty input', () => {
      const result = GetInstructorDashboardDataSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('GetAdminDashboardDataSchema', () => {
    it('should accept empty input', () => {
      const result = GetAdminDashboardDataSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

// Server function stub tests
describe('Dashboard server function stubs', () => {
  it('should export getStudentDashboardData as a function', () => {
    expect(typeof getStudentDashboardData).toBe('function');
  });

  it('should export getInstructorDashboardData as a function', () => {
    expect(typeof getInstructorDashboardData).toBe('function');
  });

  it('should export getAdminDashboardData as a function', () => {
    expect(typeof getAdminDashboardData).toBe('function');
  });
});

// Handler tests
describe('Dashboard handlers', () => {
  let mockDb: any;

  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };

  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('getStudentDashboardDataHandler', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getStudentDashboardDataHandler();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should reject if not a student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      const result = await getStudentDashboardDataHandler();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return empty data when no assignments exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      // Mock assignmentStudents join returns empty
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getStudentDashboardDataHandler();
      expect(result).toHaveProperty('activeAssignments');
      expect(result).toHaveProperty('upcomingDeadlines');
      expect(result).toHaveProperty('pendingReviews');
      expect(result).toHaveProperty('consultationReminders');
      expect((result as any).activeAssignments).toEqual([]);
      expect((result as any).upcomingDeadlines).toEqual([]);
      expect((result as any).pendingReviews).toEqual([]);
      expect((result as any).consultationReminders).toEqual([]);
    });

    it('should return populated data when assignments exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      mockDb.then
        // activeAssignments query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              title: 'Thesis',
              finalDeadline: new Date('2026-07-01'),
              templateName: 'Thesis Template',
              templateType: 'Thesis',
            },
          ]).then(onfulfilled),
        )
        // allCheckpoints query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            { assignmentId: 1, name: 'Ch 1', state: 'unlocked', dueDate: new Date('2026-06-15') },
          ]).then(onfulfilled),
        )
        // upcomingDeadlines query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              assignmentId: 1,
              assignmentTitle: 'Thesis',
              checkpointName: 'Ch 1',
              dueDate: new Date('2026-06-15'),
              state: 'unlocked',
            },
          ]).then(onfulfilled),
        )
        // pendingReviews query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              submissionId: 10,
              assignmentTitle: 'Thesis',
              checkpointName: 'Ch 1',
              submittedAt: new Date(),
            },
          ]).then(onfulfilled),
        )
        // consultationReminders query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              assignmentId: 1,
              assignmentTitle: 'Thesis',
              checkpointName: 'Ch 1',
              consultationDate: new Date(),
              consultationId: 1,
            },
          ]).then(onfulfilled),
        );

      const result = (await getStudentDashboardDataHandler()) as any;
      expect(result.activeAssignments).toHaveLength(1);
      expect(result.activeAssignments[0].title).toBe('Thesis');
      expect(result.upcomingDeadlines).toHaveLength(1);
      expect(result.pendingReviews).toHaveLength(1);
      expect(result.consultationReminders).toHaveLength(1);
    });

    it('should include all checkpoints in upcoming deadlines (no NULL dueDate filter)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      mockDb.then
        // activeAssignments query → return 1 assignment
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              title: 'Thesis',
              finalDeadline: new Date('2026-07-01'),
              templateName: 'Thesis Template',
              templateType: 'Thesis',
            },
          ]).then(onfulfilled),
        )
        // allCheckpoints query → return 3 checkpoints
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            { assignmentId: 1, name: 'Ch 1', state: 'unlocked', dueDate: new Date('2026-06-15') },
            { assignmentId: 1, name: 'Ch 2', state: 'locked', dueDate: new Date('2026-07-15') },
            { assignmentId: 1, name: 'Ch 3', state: 'locked', dueDate: new Date('2026-08-15') },
          ]).then(onfulfilled),
        )
        // upcomingDeadlines query → return all 3 (no IS NOT NULL filter)
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              assignmentId: 1,
              assignmentTitle: 'Thesis',
              checkpointName: 'Ch 1',
              dueDate: new Date('2026-06-15'),
              state: 'unlocked',
            },
            {
              assignmentId: 1,
              assignmentTitle: 'Thesis',
              checkpointName: 'Ch 2',
              dueDate: new Date('2026-07-15'),
              state: 'locked',
            },
            {
              assignmentId: 1,
              assignmentTitle: 'Thesis',
              checkpointName: 'Ch 3',
              dueDate: new Date('2026-08-15'),
              state: 'locked',
            },
          ]).then(onfulfilled),
        )
        // pendingReviews query → empty
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        // consultationReminders query → empty
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = (await getStudentDashboardDataHandler()) as any;
      expect(result.upcomingDeadlines).toHaveLength(3);
      expect(result.upcomingDeadlines[0].checkpointName).toBe('Ch 1');
      expect(result.upcomingDeadlines[1].checkpointName).toBe('Ch 2');
      expect(result.upcomingDeadlines[2].checkpointName).toBe('Ch 3');
    });
  });

  describe('getInstructorDashboardDataHandler', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getInstructorDashboardDataHandler();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should reject if not an instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      const result = await getInstructorDashboardDataHandler();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return empty data when no assignments exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getInstructorDashboardDataHandler();
      expect(result).toHaveProperty('pendingReviewCount');
      expect(result).toHaveProperty('pendingReviewItems');
      expect(result).toHaveProperty('recentSubmissions');
      expect(result).toHaveProperty('assignments');
    });

    it('should return populated data when assignments exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        // instructorAssignments query → returns 1 assignment
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        )
        // pending review count query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 2 }]).then(onfulfilled),
        )
        // pending review items query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              submissionId: 10,
              checkpointId: 100,
              checkpointName: 'Ch 1',
              assignmentTitle: 'Thesis',
              studentName: 'Alice',
              submittedAt: new Date(),
            },
          ]).then(onfulfilled),
        )
        // recent submissions query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              submissionId: 10,
              studentName: 'Alice',
              assignmentTitle: 'Thesis',
              checkpointName: 'Ch 1',
              submittedAt: new Date(),
              checkpointState: 'submitted',
            },
          ]).then(onfulfilled),
        )
        // assignment overview query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            { id: 1, title: 'Thesis', finalDeadline: null, createdAt: new Date() },
          ]).then(onfulfilled),
        )
        // student count query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ assignmentId: 1, count: 5 }]).then(onfulfilled),
        )
        // pending counts query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ assignmentId: 1, count: 2 }]).then(onfulfilled),
        )
        // progress data query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ assignmentId: 1, totalCount: 3, passedCount: 1 }]).then(onfulfilled),
        );

      const result = (await getInstructorDashboardDataHandler()) as any;
      expect(result.pendingReviewCount).toBe(2);
      expect(result.pendingReviewItems).toHaveLength(1);
      expect(result.recentSubmissions).toHaveLength(1);
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].studentCount).toBe(5);
      expect(result.assignments[0].overallProgressPercent).toBe(33);
    });
  });
});
