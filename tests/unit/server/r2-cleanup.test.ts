/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerR2Cleanup } from '@/server/r2-cleanup';
import type { ServerError } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as r2CleanupMod from '@/lib/r2-cleanup';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/r2-cleanup', () => ({
  processOrphanedR2Objects: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// ---- Stub Export Tests ----

describe('R2 cleanup server function stubs', () => {
  it('exports triggerR2Cleanup as a function', () => {
    expect(typeof triggerR2Cleanup).toBe('function');
  });
});

// ---- triggerR2CleanupHandler Tests ----

describe('triggerR2CleanupHandler', () => {
  const adminSession = {
    user: {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@test.com',
      role: 'superadmin',
      locale: 'en',
      emailVerified: true,
    },
    session: {} as any,
  };

  const instructorSession = {
    user: {
      id: 'instructor-1',
      name: 'Instructor',
      email: 'instructor@test.com',
      role: 'instructor',
      locale: 'en',
      emailVerified: true,
    },
    session: {} as any,
  };

  const studentSession = {
    user: {
      id: 'student-1',
      name: 'Student',
      email: 'student@test.com',
      role: 'student',
      locale: 'en',
      emailVerified: true,
    },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(r2CleanupMod.processOrphanedR2Objects).mockResolvedValue({
      deleted: 3,
      failed: 1,
      batchSize: 4,
    });
  });

  it('admin triggers processOrphanedR2Objects directly and returns summary', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    const { triggerR2CleanupHandler } = await import('@/server/r2-cleanup.server');
    const result = await triggerR2CleanupHandler({ data: {} });

    expect(r2CleanupMod.processOrphanedR2Objects).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ deleted: 3, failed: 1, batchSize: 4 });
  });

  it('rejects instructor with UNAUTHORIZED', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const { triggerR2CleanupHandler } = await import('@/server/r2-cleanup.server');
    const result = (await triggerR2CleanupHandler({ data: {} })) as ServerError;

    expect(result).toHaveProperty('error');
    expect(result.error.code).toBe('UNAUTHORIZED');
    expect(r2CleanupMod.processOrphanedR2Objects).not.toHaveBeenCalled();
  });

  it('rejects student with UNAUTHORIZED', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const { triggerR2CleanupHandler } = await import('@/server/r2-cleanup.server');
    const result = (await triggerR2CleanupHandler({ data: {} })) as ServerError;

    expect(result).toHaveProperty('error');
    expect(result.error.code).toBe('UNAUTHORIZED');
    expect(r2CleanupMod.processOrphanedR2Objects).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated user with UNAUTHORIZED', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const { triggerR2CleanupHandler } = await import('@/server/r2-cleanup.server');
    const result = (await triggerR2CleanupHandler({ data: {} })) as ServerError;

    expect(result).toHaveProperty('error');
    expect(result.error.code).toBe('UNAUTHORIZED');
    expect(r2CleanupMod.processOrphanedR2Objects).not.toHaveBeenCalled();
  });

  it('passes admin userId as actorId to processOrphanedR2Objects', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    const { triggerR2CleanupHandler } = await import('@/server/r2-cleanup.server');
    await triggerR2CleanupHandler({ data: {} });

    expect(r2CleanupMod.processOrphanedR2Objects).toHaveBeenCalledWith('admin-1');
  });

  it('accepts admin role (not just superadmin)', async () => {
    const adminRoleSession = {
      ...adminSession,
      user: { ...adminSession.user, id: 'admin-2', role: 'admin' },
    };
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminRoleSession as any);

    const { triggerR2CleanupHandler } = await import('@/server/r2-cleanup.server');
    const result = await triggerR2CleanupHandler({ data: {} });

    expect(r2CleanupMod.processOrphanedR2Objects).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ deleted: 3, failed: 1, batchSize: 4 });
  });

  it('returns summary even when no orphans found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    vi.mocked(r2CleanupMod.processOrphanedR2Objects).mockResolvedValue({
      deleted: 0,
      failed: 0,
      batchSize: 0,
    });

    const { triggerR2CleanupHandler } = await import('@/server/r2-cleanup.server');
    const result = await triggerR2CleanupHandler({ data: {} });

    expect(result).toEqual({ deleted: 0, failed: 0, batchSize: 0 });
    expect(r2CleanupMod.processOrphanedR2Objects).toHaveBeenCalledWith('admin-1');
  });

  it('handles processOrphanedR2Objects failure with INTERNAL server error', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    vi.mocked(r2CleanupMod.processOrphanedR2Objects).mockRejectedValue(
      new Error('DB connection failed'),
    );

    const { triggerR2CleanupHandler } = await import('@/server/r2-cleanup.server');
    const result = (await triggerR2CleanupHandler({ data: {} })) as ServerError;

    expect(result).toHaveProperty('error');
    expect(result.error.code).toBe('INTERNAL');
  });
});
