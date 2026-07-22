/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportUsersCsvHandler,
  exportAuditLogCsvHandler,
  exportAssignmentProgressCsvHandler,
  exportStudentProgressCsvHandler,
  exportReviewHistoryCsvHandler,
} from '@/server/analytics-export.server';
import { isServerError } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

const adminSession = {
  user: { id: 'admin-1', name: 'Admin', role: 'admin' as const },
  session: {} as any,
};

const superadminSession = {
  user: { id: 'super-1', name: 'Super', role: 'superadmin' as const },
  session: {} as any,
};

const instructorSession = {
  user: { id: 'instructor-1', name: 'Instructor', role: 'instructor' as const },
  session: {} as any,
};

const studentSession = {
  user: { id: 'student-1', name: 'Student', role: 'student' as const },
  session: {} as any,
};

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    then: vi.fn(function (this: any, onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };
}

describe('CSV Export Handlers', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('exportUsersCsvHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await exportUsersCsvHandler({ data: {} });
      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject if not admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      const result = await exportUsersCsvHandler({ data: {} });
      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
    });

    it('should return CSV string with headers and user rows', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 'uuid-1',
            name: 'John Doe',
            email: 'john@test.com',
            role: 'student',
            deletedAt: null,
            createdAt: new Date('2026-01-01'),
          },
          {
            id: 'uuid-2',
            name: 'Jane, Smith',
            email: 'jane@test.com',
            role: 'instructor',
            deletedAt: new Date('2026-01-10'),
            createdAt: new Date('2026-01-02'),
          },
        ]).then(onfulfilled),
      );

      const result = await exportUsersCsvHandler({ data: {} });
      expect(typeof result).toBe('string');
      const csv = result as string;
      const lines = csv.split('\n');
      expect(lines[0]).toBe('ID,Name,Email,Role,Status,Created At');
      expect(lines[1]).toContain('uuid-1');
      expect(lines[1]).toContain('John Doe');
      expect(lines[1]).toContain('Active');
      // Jane, Smith should be quoted because it contains a comma
      expect(lines[2]).toContain('"Jane, Smith"');
      expect(lines[2]).toContain('Deleted');
    });

    it('should return headers only when no users', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      const result = await exportUsersCsvHandler({ data: {} });
      expect(typeof result).toBe('string');
      const csv = result as string;
      const lines = csv.split('\n');
      expect(lines[0]).toBe('ID,Name,Email,Role,Status,Created At');
      expect(lines).toHaveLength(1);
    });

    it('should accept superadmin role', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(superadminSession as any);
      const result = await exportUsersCsvHandler({ data: {} });
      expect(typeof result).toBe('string');
    });
  });

  describe('exportAuditLogCsvHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await exportAuditLogCsvHandler({ data: {} });
      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject if not admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      const result = await exportAuditLogCsvHandler({ data: {} });
      expect(isServerError(result)).toBe(true);
    });

    it('should return CSV string with headers and audit log rows', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            createdAt: new Date('2026-01-01'),
            action: 'user.create',
            actorName: 'Admin',
            entityType: 'user',
            entityId: 'uuid-1',
            details: { key: 'value' },
          },
        ]).then(onfulfilled),
      );

      const result = await exportAuditLogCsvHandler({ data: {} });
      expect(typeof result).toBe('string');
      const csv = result as string;
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Timestamp,Action,Actor,Entity Type,Entity ID,Details');
      expect(lines[1]).toContain('user.create');
      expect(lines[1]).toContain('Admin');
    });

    it('should return headers only when no entries', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      const result = await exportAuditLogCsvHandler({ data: {} });
      expect(typeof result).toBe('string');
      const csv = result as string;
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Timestamp,Action,Actor,Entity Type,Entity ID,Details');
      expect(lines).toHaveLength(1);
    });

    it('should apply date filtering when dateFrom and dateTo provided', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      await exportAuditLogCsvHandler({
        data: { dateFrom: '2026-01-01', dateTo: '2026-07-22' },
      });
      // Verify where was called (date filtering applied)
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('exportAssignmentProgressCsvHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await exportAssignmentProgressCsvHandler({ data: {} });
      expect(isServerError(result)).toBe(true);
    });

    it('should reject if not admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      const result = await exportAssignmentProgressCsvHandler({ data: {} });
      expect(isServerError(result)).toBe(true);
    });

    it('should return CSV string with headers and progress rows', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            assignmentTitle: 'Thesis 2026',
            studentName: 'John Doe',
            checkpointState: 'passed',
            checkpointOrder: 1,
          },
          {
            assignmentTitle: 'Thesis 2026',
            studentName: 'John Doe',
            checkpointState: 'unlocked',
            checkpointOrder: 2,
          },
        ]).then(onfulfilled),
      );

      const result = await exportAssignmentProgressCsvHandler({ data: {} });
      expect(typeof result).toBe('string');
      const csv = result as string;
      const lines = csv.split('\n');
      expect(lines[0]).toBe(
        'Assignment Title,Student Name,Checkpoint States,Completion Percentage',
      );
      expect(lines[1]).toContain('Thesis 2026');
      expect(lines[1]).toContain('John Doe');
    });

    it('should return headers only when no data', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      const result = await exportAssignmentProgressCsvHandler({ data: {} });
      expect(typeof result).toBe('string');
      const csv = result as string;
      const lines = csv.split('\n');
      expect(lines[0]).toBe(
        'Assignment Title,Student Name,Checkpoint States,Completion Percentage',
      );
      expect(lines).toHaveLength(1);
    });
  });

  describe('exportStudentProgressCsvHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await exportStudentProgressCsvHandler({ data: { assignmentId: 1 } });
      expect(isServerError(result)).toBe(true);
    });

    it('should reject if not instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      const result = await exportStudentProgressCsvHandler({ data: { assignmentId: 1 } });
      expect(isServerError(result)).toBe(true);
    });

    it('should return CSV string with headers and student progress rows', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      // First query: ownership check (assignment belongs to instructor)
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, instructorId: 'instructor-1' }]).then(onfulfilled),
        )
        // Second query: checkpoint data
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            { studentName: 'John Doe', checkpointState: 'passed', checkpointOrder: 1 },
            { studentName: 'John Doe', checkpointState: 'locked', checkpointOrder: 2 },
            { studentName: 'Jane Smith', checkpointState: 'passed', checkpointOrder: 1 },
          ]).then(onfulfilled),
        );

      const result = await exportStudentProgressCsvHandler({ data: { assignmentId: 1 } });
      expect(typeof result).toBe('string');
      const csv = result as string;
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Student Name,Checkpoint States,Completion Percentage');
      expect(lines[1]).toContain('John Doe');
      expect(lines[1]).toContain('50'); // 1 of 2 passed = 50%
      expect(lines[2]).toContain('Jane Smith');
      expect(lines[2]).toContain('100'); // 1 of 1 passed = 100%
    });

    it('should reject if assignment does not belong to instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      // Ownership check returns empty (assignment not found or not owned)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await exportStudentProgressCsvHandler({ data: { assignmentId: 999 } });
      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should return headers only when no checkpoint data', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, instructorId: 'instructor-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await exportStudentProgressCsvHandler({ data: { assignmentId: 1 } });
      expect(typeof result).toBe('string');
      const csv = result as string;
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Student Name,Checkpoint States,Completion Percentage');
      expect(lines).toHaveLength(1);
    });
  });

  describe('exportReviewHistoryCsvHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await exportReviewHistoryCsvHandler({ data: { assignmentId: 1 } });
      expect(isServerError(result)).toBe(true);
    });

    it('should reject if not instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      const result = await exportReviewHistoryCsvHandler({ data: { assignmentId: 1 } });
      expect(isServerError(result)).toBe(true);
    });

    it('should return CSV string with headers and review rows', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            submissionId: 1,
            studentName: 'John Doe',
            decision: 'pass',
            comment: 'Good work',
            reviewedAt: new Date('2026-01-10'),
            uploadedAt: new Date('2026-01-08'),
          },
        ]).then(onfulfilled),
      );

      const result = await exportReviewHistoryCsvHandler({ data: { assignmentId: 1 } });
      expect(typeof result).toBe('string');
      const csv = result as string;
      const lines = csv.split('\n');
      expect(lines[0]).toBe(
        'Submission ID,Student,Decision,Comment,Reviewed At,Response Time (Hours)',
      );
      expect(lines[1]).toContain('John Doe');
      expect(lines[1]).toContain('pass');
    });

    it('should return headers only when no reviews', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      const result = await exportReviewHistoryCsvHandler({ data: { assignmentId: 1 } });
      expect(typeof result).toBe('string');
      const csv = result as string;
      const lines = csv.split('\n');
      expect(lines[0]).toBe(
        'Submission ID,Student,Decision,Comment,Reviewed At,Response Time (Hours)',
      );
      expect(lines).toHaveLength(1);
    });
  });
});
