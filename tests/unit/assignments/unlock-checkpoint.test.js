/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnlockCheckpointSchema, unlockCheckpoint } from '@/server/assignments';
import { unlockCheckpointHandler } from '@/server/assignments.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));
vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));
// Schema validation tests
describe('UnlockCheckpointSchema', () => {
  it('should accept valid checkpoint id', () => {
    const result = UnlockCheckpointSchema.safeParse({ checkpointId: 1 });
    expect(result.success).toBe(true);
  });
  it('should reject non-positive checkpoint id', () => {
    const result = UnlockCheckpointSchema.safeParse({ checkpointId: 0 });
    expect(result.success).toBe(false);
  });
  it('should reject missing checkpoint id', () => {
    const result = UnlockCheckpointSchema.safeParse({});
    expect(result.success).toBe(false);
  });
  it('should reject non-integer checkpoint id', () => {
    const result = UnlockCheckpointSchema.safeParse({ checkpointId: 'abc' });
    expect(result.success).toBe(false);
  });
});
// Server function stub tests
describe('unlockCheckpoint server function stub', () => {
  it('should export unlockCheckpoint as a function', () => {
    expect(typeof unlockCheckpoint).toBe('function');
  });
});
// Handler logic tests
describe('unlockCheckpointHandler', () => {
  let mockDb;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' },
    session: {},
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' },
    session: {},
  };
  function makeCheckpointRow(overrides) {
    return [
      {
        id: 100,
        state: 'locked',
        assignmentInstructorId: 'instructor-1',
        assignmentId: 1,
        ...overrides,
      },
    ];
  }
  beforeEach(() => {
    vi.clearAllMocks();
    const _resolveRows = [];
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
      // Override then dynamically per test by replacing the whole mockDb
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });
  /** Helper: run handler with a custom db query result */
  async function runHandlerWithResult(rows, input) {
    // Create a one-off thenable mock that resolves to `rows`
    const queryMock = {
      ...mockDb,
      then: (onfulfilled) => Promise.resolve(rows).then(onfulfilled),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(queryMock);
    return unlockCheckpointHandler({ data: input });
  }
  it('should unlock a locked checkpoint in own assignment', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    const result = await runHandlerWithResult(makeCheckpointRow({ state: 'locked' }), {
      checkpointId: 100,
    });
    expect(result).toEqual({ success: true });
  });
  it('should return error if checkpoint is already unlocked', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    const result = await runHandlerWithResult(makeCheckpointRow({ state: 'unlocked' }), {
      checkpointId: 100,
    });
    expect(result).toEqual({ error: 'Checkpoint is not in locked state' });
  });
  it('should return error if checkpoint is already passed', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    const result = await runHandlerWithResult(makeCheckpointRow({ state: 'passed' }), {
      checkpointId: 100,
    });
    expect(result).toEqual({ error: 'Checkpoint is not in locked state' });
  });
  it('should return error if checkpoint not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    const result = await runHandlerWithResult([], { checkpointId: 999 });
    expect(result).toEqual({ error: 'Checkpoint not found' });
  });
  it('should return error if non-owner instructor tries to unlock', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    // Empty result simulates both not-found and non-ownership (same behavior)
    const result = await runHandlerWithResult([], { checkpointId: 200 });
    expect(result).toEqual({ error: 'Checkpoint not found' });
  });
  it('should reject non-instructor users', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
    const result = await unlockCheckpointHandler({
      data: { checkpointId: 100 },
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });
  it('should reject unauthenticated users', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await unlockCheckpointHandler({
      data: { checkpointId: 100 },
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });
  it('should update updatedAt when unlocking', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    await runHandlerWithResult(makeCheckpointRow({ state: 'locked' }), { checkpointId: 100 });
    // Verify update was called with updatedAt
    expect(mockDb.update).toHaveBeenCalled();
    // Verify set was called with the right state
    const setCall = mockDb.set.mock.calls[0][0];
    expect(setCall.state).toBe('unlocked');
    expect(setCall.updatedAt).toBeInstanceOf(Date);
  });
});
