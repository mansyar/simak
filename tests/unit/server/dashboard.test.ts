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

  const adminSession = {
    user: { id: 'admin-1', role: 'admin' as const },
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
  });

  describe('getAdminDashboardDataHandler', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getAdminDashboardDataHandler();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should reject if not an admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      const result = await getAdminDashboardDataHandler();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return metrics when data exists', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      // Mock user counts query
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ total: 10, instructors: 2, students: 5 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ activeAssignmentCount: 3 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ pendingReviewCount: 7 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ activeConsultationCount: 4 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await getAdminDashboardDataHandler();
      expect(result).toHaveProperty('metrics');
      expect((result as any).metrics).toHaveProperty('totalUsers', 10);
      expect((result as any).metrics).toHaveProperty('instructors', 2);
      expect((result as any).metrics).toHaveProperty('students', 5);
      expect((result as any).metrics).toHaveProperty('activeAssignments', 3);
      expect((result as any).metrics).toHaveProperty('pendingReviews', 7);
      expect((result as any).metrics).toHaveProperty('activeConsultations', 4);
    });
  });
});
