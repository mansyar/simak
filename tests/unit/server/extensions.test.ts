/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  RequestExtensionSchema,
  ListExtensionRequestsSchema,
  ApproveExtensionSchema,
  RejectExtensionSchema,
  BulkExtendSchema,
} from '@/server/extensions';
import { requestExtensionHandler } from '@/server/extensions.server';
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

// ============================================================
// Schema validation tests
// ============================================================
describe('Extension Schemas', () => {
  describe('RequestExtensionSchema', () => {
    it('should accept valid input with all fields', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        category: 'personal',
        reason: 'I need more time to complete this assignment due to personal matters',
        extensionDays: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should accept input with checkpointId', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        checkpointId: 10,
        category: 'health',
        reason: 'Medical appointment conflicts with current deadline',
        extensionDays: 3,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid category', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        category: 'invalid',
        reason: 'Some valid reason here with enough characters',
        extensionDays: 5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject reason shorter than 10 characters', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        category: 'other',
        reason: 'Short',
        extensionDays: 5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject extensionDays less than 1', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        category: 'research',
        reason: 'Research extension needed for data collection phase',
        extensionDays: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject extensionDays greater than 30', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        category: 'personal',
        reason: 'Extended leave of absence due to family emergency',
        extensionDays: 31,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing assignmentId', () => {
      const result = RequestExtensionSchema.safeParse({
        category: 'personal',
        reason: 'Personal reasons for needing more time on this project',
        extensionDays: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RejectExtensionSchema', () => {
    it('should accept valid input with long enough reason', () => {
      const result = RejectExtensionSchema.safeParse({
        requestId: 1,
        resolutionReason:
          'This is a very long and detailed reason for rejecting the extension request',
      });
      expect(result.success).toBe(true);
    });

    it('should reject resolutionReason shorter than 20 characters', () => {
      const result = RejectExtensionSchema.safeParse({
        requestId: 1,
        resolutionReason: 'Too short',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing resolutionReason', () => {
      const result = RejectExtensionSchema.safeParse({
        requestId: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ApproveExtensionSchema', () => {
    it('should accept valid input', () => {
      const result = ApproveExtensionSchema.safeParse({
        requestId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should accept with optional resolutionReason', () => {
      const result = ApproveExtensionSchema.safeParse({
        requestId: 1,
        resolutionReason: 'Approved due to valid circumstances',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('BulkExtendSchema', () => {
    it('should accept valid input', () => {
      const result = BulkExtendSchema.safeParse({
        assignmentId: 1,
        studentId: 'student-1',
        extraDays: 7,
        reason: 'General extension for whole class',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-positive extraDays', () => {
      const result = BulkExtendSchema.safeParse({
        assignmentId: 1,
        studentId: 'student-1',
        extraDays: 0,
        reason: 'Some reason',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ListExtensionRequestsSchema', () => {
    it('should accept valid input with defaults', () => {
      const result = ListExtensionRequestsSchema.safeParse({
        assignmentId: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should accept input with status filter', () => {
      const result = ListExtensionRequestsSchema.safeParse({
        assignmentId: 1,
        status: 'pending',
        page: 2,
        limit: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = ListExtensionRequestsSchema.safeParse({
        assignmentId: 1,
        status: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================
// Handler tests
// ============================================================
describe('requestExtensionHandler', () => {
  let mockDb: any;
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };

  const validInput = {
    assignmentId: 1,
    category: 'personal' as const,
    reason: 'I need more time to complete this assignment due to personal matters',
    extensionDays: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should reject if unauthorized (no session)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const result = await requestExtensionHandler({ data: validInput });
    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should reject if not a student', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const result = await requestExtensionHandler({ data: validInput });
    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should reject if student is not enrolled in the assignment', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // Enrollment check returns empty (student not enrolled)
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await requestExtensionHandler({ data: validInput });
    expect(result).toEqual({ error: 'Assignment not found' });
  });

  it('should reject if extensionDays exceeds max_extension_days cap', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // Query 1: Enrollment check passes
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      // Query 2: Assignment with caps (maxExtensionDays = 3)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 3, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      );

    const result = await requestExtensionHandler({
      data: { ...validInput, extensionDays: 5 },
    });
    expect(result).toEqual({ error: 'Extension days cannot exceed 3 for this assignment' });
  });

  it('should reject if max total extensions exceeded', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // Query 1: Enrollment check passes
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      // Query 2: Assignment caps (maxTotalExtensions = 2)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 2, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      // Query 3: Active extension count = 2 (already at max)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 2 }]).then(onfulfilled),
      );

    const result = await requestExtensionHandler({ data: validInput });
    expect(result).toEqual({
      error: 'Maximum 2 extension(s) allowed for this assignment. You have used 2.',
    });
  });

  it('should create extension request successfully with default checkpoint', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // Query 1: Enrollment check passes
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      // Query 2: Assignment caps
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      // Query 3: Active extension count = 0
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      )
      // Query 4: findActiveCheckpoint - returns active checkpoint
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 10, dueDate: new Date('2026-06-15'), order: 1 }]).then(onfulfilled),
      )
      // Query 5: Target checkpoint lookup (always runs after findActiveCheckpoint)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ dueDate: new Date('2026-06-15') }]).then(onfulfilled),
      );

    // INSERT + RETURNING for extension request
    mockDb.returning.mockResolvedValue([{ id: 100 }]);

    const result = await requestExtensionHandler({ data: validInput });
    expect(result).toHaveProperty('extensionRequest');
    expect(result.extensionRequest!.id).toBe(100);
  });

  it('should create extension request with specific checkpointId', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // Query 1: Enrollment check passes
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      // Query 2: Assignment caps
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      // Query 3: Active extension count = 0
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      )
      // Query 4: findActiveCheckpoint is SKIPPED because checkpointId is provided
      // Query 5: Target checkpoint lookup
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 10, dueDate: new Date('2026-06-15') }]).then(onfulfilled),
      );

    mockDb.returning.mockResolvedValue([{ id: 101 }]);

    const result = await requestExtensionHandler({
      data: { ...validInput, checkpointId: 10 },
    });
    expect(result).toHaveProperty('extensionRequest');
    expect(result.extensionRequest!.id).toBe(101);
  });

  it('should return error if target checkpoint not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // With checkpointId=15 provided, findActiveCheckpoint is SKIPPED.
    // Only 4 queries: enrollment, assignment, count, then target CP lookup.
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      )
      // Target CP lookup returns empty → error
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await requestExtensionHandler({
      data: { ...validInput, checkpointId: 15 },
    });
    expect(result).toEqual({ error: 'Checkpoint not found' });
  });

  it('should notify instructor via notification insert', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 10, dueDate: new Date('2026-06-15'), order: 1 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ dueDate: new Date('2026-06-15') }]).then(onfulfilled),
      );

    mockDb.returning.mockResolvedValue([{ id: 100 }]);

    await requestExtensionHandler({ data: validInput });

    // Should have called insert twice: extension request + notification
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const notificationValues = valuesCalls[1][0];
    expect(notificationValues.userId).toBe('instructor-1');
    expect(notificationValues.type).toBe('extension_requested');
  });
});
