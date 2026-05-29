/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ExtendDeadlineSchema, extendDeadline } from '@/server/assignments';
import { extendDeadlineHandler } from '@/server/assignments.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

// Schema validation tests
describe('ExtendDeadlineSchema', () => {
  it('should accept valid checkpoint id and future date', () => {
    const futureDate = new Date(Date.now() + 86400000); // 1 day from now
    const result = ExtendDeadlineSchema.safeParse({
      checkpointId: 1,
      newDueDate: futureDate.toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-positive checkpoint id', () => {
    const futureDate = new Date(Date.now() + 86400000);
    const result = ExtendDeadlineSchema.safeParse({
      checkpointId: 0,
      newDueDate: futureDate.toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing checkpoint id', () => {
    const futureDate = new Date(Date.now() + 86400000);
    const result = ExtendDeadlineSchema.safeParse({
      newDueDate: futureDate.toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer checkpoint id', () => {
    const futureDate = new Date(Date.now() + 86400000);
    const result = ExtendDeadlineSchema.safeParse({
      checkpointId: 'abc',
      newDueDate: futureDate.toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject past date', () => {
    const pastDate = new Date(Date.now() - 86400000); // 1 day ago
    const result = ExtendDeadlineSchema.safeParse({
      checkpointId: 1,
      newDueDate: pastDate.toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing newDueDate', () => {
    const result = ExtendDeadlineSchema.safeParse({
      checkpointId: 1,
    });
    expect(result.success).toBe(false);
  });
});

// Server function stub tests
describe('extendDeadline server function stub', () => {
  it('should export extendDeadline as a function', () => {
    expect(typeof extendDeadline).toBe('function');
  });
});

// Handler logic tests
describe('extendDeadlineHandler', () => {
  let mockDb: any;
  const futureDate = new Date(Date.now() + 7 * 86400000); // 7 days from now
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };

  function makeCheckpointRow(overrides?: Record<string, unknown>) {
    return [
      {
        id: 100,
        dueDate: new Date(Date.now() + 3 * 86400000),
        assignmentInstructorId: 'instructor-1',
        assignmentId: 1,
        ...overrides,
      },
    ];
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
    };

    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  /** Helper: run handler with a custom db query result */
  async function runHandlerWithResult(
    rows: any[],
    input: { checkpointId: number; newDueDate: Date },
  ) {
    const queryMock = {
      ...mockDb,
      then: (onfulfilled: any) => Promise.resolve(rows).then(onfulfilled),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(queryMock as any);

    return extendDeadlineHandler({ data: input });
  }

  it('should extend a checkpoint due date in own assignment', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const result = await runHandlerWithResult(makeCheckpointRow(), {
      checkpointId: 100,
      newDueDate: futureDate,
    });

    expect(result).toEqual({ success: true });
  });

  it('should update the dueDate and updatedAt when extending', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    await runHandlerWithResult(makeCheckpointRow(), { checkpointId: 100, newDueDate: futureDate });

    expect(mockDb.update).toHaveBeenCalled();
    const setCall = mockDb.set.mock.calls[0][0];
    expect(setCall.dueDate).toEqual(futureDate);
    expect(setCall.updatedAt).toBeInstanceOf(Date);
  });

  it('should return error if checkpoint not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const result = await runHandlerWithResult([], { checkpointId: 999, newDueDate: futureDate });

    expect(result).toEqual({ error: 'Checkpoint not found' });
  });

  it('should return error if non-owner instructor tries to extend', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    // Empty result simulates both not-found and non-ownership (same behavior)
    const result = await runHandlerWithResult([], { checkpointId: 200, newDueDate: futureDate });

    expect(result).toEqual({ error: 'Checkpoint not found' });
  });

  it('should reject non-instructor users', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const result = await extendDeadlineHandler({
      data: { checkpointId: 100, newDueDate: futureDate },
    });

    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should reject unauthenticated users', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const result = await extendDeadlineHandler({
      data: { checkpointId: 100, newDueDate: futureDate },
    });

    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should extend any checkpoint regardless of state', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    // Test with a checkpoint in 'submitted' state (not locked)
    const result = await runHandlerWithResult(makeCheckpointRow({ state: 'submitted' }), {
      checkpointId: 100,
      newDueDate: futureDate,
    });

    expect(result).toEqual({ success: true });
  });
});
