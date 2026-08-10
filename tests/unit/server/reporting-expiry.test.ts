/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  runReportExpiryCleanup,
  runReportExpiryCleanupHandler,
  type ExpiryCleanupDependencies,
} from '@/server/reporting-expiry.server';
import { REPORT_STALE_FAILURE_CODE } from '@/lib/report-job-transitions.server';

const completedJob = {
  id: 1,
  reportType: 'analytics_summary' as const,
  requesterId: 'admin-1',
  parameters: { termId: null, courseId: null, sectionId: null, cohort: null },
  locale: 'en' as const,
  state: 'completed' as const,
  attempts: 1,
  artifactKey: 'reports/opaque.pdf',
  artifactSizeBytes: 3,
  artifactSha256: 'abc',
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-08-01T10:00:00Z'),
  updatedAt: new Date('2026-08-01T10:00:00Z'),
  startedAt: new Date('2026-08-01T10:00:00Z'),
  completedAt: new Date('2026-08-01T10:00:00Z'),
  failedAt: null,
  expiresAt: new Date('2026-08-01T10:00:00Z'),
};

const staleExpiredJob = {
  ...completedJob,
  id: 2,
  reportType: 'official_transcript' as const,
  state: 'expired' as const,
};

function dependencies(overrides: Partial<ExpiryCleanupDependencies> = {}) {
  const deps: ExpiryCleanupDependencies = {
    getSession: vi.fn().mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } }),
    selectDueCompleted: vi.fn().mockResolvedValue([]),
    selectStaleExpired: vi.fn().mockResolvedValue([]),
    selectStaleProcessing: vi.fn().mockResolvedValue([]),
    failStaleJob: vi.fn().mockResolvedValue(null),
    expireJob: vi.fn().mockImplementation(async (jobId: number) => ({
      ...completedJob,
      id: jobId,
      state: 'expired',
    })),
    deleteArtifact: vi.fn().mockResolvedValue('deleted'),
    finalizeJob: vi.fn().mockResolvedValue({ ...completedJob, state: 'expired' }),
    audit: vi.fn().mockResolvedValue(undefined),
    log: { info: vi.fn(), error: vi.fn() },
    ...overrides,
  };
  return deps;
}

describe('report expiry cleanup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('expires due completed reports before deleting artifacts, then finalizes', async () => {
    const deps = dependencies({ selectDueCompleted: vi.fn().mockResolvedValue([completedJob]) });

    await expect(runReportExpiryCleanup(50, 'admin-1', deps)).resolves.toEqual({
      dueCompleted: 1,
      staleExpired: 0,
      staleFailed: 0,
      expired: 1,
      finalized: 1,
      failedDeletions: 0,
    });
    expect(deps.expireJob).toHaveBeenCalledWith(1);
    expect(deps.deleteArtifact).toHaveBeenCalledWith('reports/opaque.pdf');
    expect(deps.finalizeJob).toHaveBeenCalledWith(1);
    expect(vi.mocked(deps.expireJob).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.deleteArtifact).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(deps.deleteArtifact).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.finalizeJob).mock.invocationCallOrder[0],
    );
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report_expired', entityId: '1' }),
    );
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report_expiry_cleanup',
        details: expect.objectContaining({ expired: 1 }),
      }),
    );
  });

  it('skips jobs another run already expired', async () => {
    const deps = dependencies({
      selectDueCompleted: vi.fn().mockResolvedValue([completedJob]),
      expireJob: vi.fn().mockResolvedValue(null),
    });

    await expect(runReportExpiryCleanup(50, 'admin-1', deps)).resolves.toEqual({
      dueCompleted: 1,
      staleExpired: 0,
      staleFailed: 0,
      expired: 0,
      finalized: 0,
      failedDeletions: 0,
    });
    expect(deps.deleteArtifact).not.toHaveBeenCalled();
    expect(deps.finalizeJob).not.toHaveBeenCalled();
    expect(deps.audit).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report_expired' }),
    );
  });

  it('tolerates an already-missing object and still finalizes', async () => {
    const deps = dependencies({
      selectDueCompleted: vi.fn().mockResolvedValue([completedJob]),
      deleteArtifact: vi.fn().mockResolvedValue('not_found'),
    });

    await expect(runReportExpiryCleanup(50, 'admin-1', deps)).resolves.toEqual({
      dueCompleted: 1,
      staleExpired: 0,
      staleFailed: 0,
      expired: 1,
      finalized: 1,
      failedDeletions: 0,
    });
    expect(deps.finalizeJob).toHaveBeenCalledWith(1);
  });

  it('keeps a job expired-with-key after a deletion failure and still processes the rest', async () => {
    const second = { ...completedJob, id: 3, artifactKey: 'reports/second.pdf' };
    const deps = dependencies({
      selectDueCompleted: vi.fn().mockResolvedValue([completedJob, second]),
      deleteArtifact: vi
        .fn()
        .mockRejectedValueOnce(new Error('R2 unavailable'))
        .mockResolvedValue('deleted'),
    });

    const summary = await runReportExpiryCleanup(50, 'admin-1', deps);

    expect(summary).toEqual({
      dueCompleted: 2,
      staleExpired: 0,
      staleFailed: 0,
      expired: 2,
      finalized: 1,
      failedDeletions: 1,
    });
    expect(deps.finalizeJob).toHaveBeenCalledTimes(1);
    expect(deps.finalizeJob).toHaveBeenCalledWith(3);
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report_expiry_cleanup_failed', entityId: '1' }),
    );
    expect(deps.log.error).toHaveBeenCalledWith({
      event: 'report_expiry_cleanup_failed',
      reportJobId: 1,
      reportType: 'analytics_summary',
    });
  });

  it('snapshots stale expired jobs before processing newly due jobs', async () => {
    const deps = dependencies({
      selectStaleExpired: vi.fn().mockResolvedValue([staleExpiredJob]),
      selectDueCompleted: vi.fn().mockResolvedValue([completedJob]),
    });

    await runReportExpiryCleanup(50, 'admin-1', deps);

    const staleOrder = vi.mocked(deps.selectStaleExpired).mock.invocationCallOrder[0];
    const dueOrder = vi.mocked(deps.selectDueCompleted).mock.invocationCallOrder[0];
    const expireOrder = vi.mocked(deps.expireJob).mock.invocationCallOrder[0];
    expect(staleOrder).toBeLessThan(dueOrder);
    expect(staleOrder).toBeLessThan(expireOrder);
    expect(vi.mocked(deps.deleteArtifact).mock.invocationCallOrder[0]).toBeLessThan(expireOrder);
  });

  it('fails stale processing jobs before snapshotting due jobs', async () => {
    const processingJob = { ...completedJob, id: 4, state: 'processing' as const };
    const deps = dependencies({
      selectStaleProcessing: vi.fn().mockResolvedValue([processingJob]),
      failStaleJob: vi.fn().mockResolvedValue({ ...processingJob, state: 'failed' }),
    });

    await expect(runReportExpiryCleanup(50, 'admin-1', deps)).resolves.toEqual({
      dueCompleted: 0,
      staleExpired: 0,
      staleFailed: 1,
      expired: 0,
      finalized: 0,
      failedDeletions: 0,
    });
    expect(deps.failStaleJob).toHaveBeenCalledWith(4);
    expect(vi.mocked(deps.selectStaleProcessing).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.selectDueCompleted).mock.invocationCallOrder[0],
    );
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report_stale_failed',
        entityId: '4',
        details: expect.objectContaining({ failureCode: REPORT_STALE_FAILURE_CODE }),
      }),
    );
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report_expiry_cleanup',
        details: expect.objectContaining({ staleFailed: 1 }),
      }),
    );
  });

  it('counts a shared stale-fail once when a concurrent run wins', async () => {
    const processingJob = { ...completedJob, id: 5, state: 'processing' as const };
    const failed = new Set<number>();
    const deps = dependencies({
      selectStaleProcessing: vi.fn().mockResolvedValue([processingJob]),
      failStaleJob: vi.fn().mockImplementation(async (jobId: number) => {
        if (failed.has(jobId)) return null;
        failed.add(jobId);
        return { ...processingJob, id: jobId, state: 'failed' };
      }),
    });

    const [first, second] = await Promise.all([
      runReportExpiryCleanup(50, 'admin-1', deps),
      runReportExpiryCleanup(50, 'admin-1', deps),
    ]);

    expect(first.staleFailed + second.staleFailed).toBe(1);
  });

  it('does not retry a failed deletion within the same run', async () => {
    const deps = dependencies({
      selectDueCompleted: vi.fn().mockResolvedValue([completedJob]),
      deleteArtifact: vi.fn().mockRejectedValue(new Error('R2 unavailable')),
    });

    await expect(runReportExpiryCleanup(50, 'admin-1', deps)).resolves.toEqual({
      dueCompleted: 1,
      staleExpired: 0,
      staleFailed: 0,
      expired: 1,
      finalized: 0,
      failedDeletions: 1,
    });
    expect(deps.deleteArtifact).toHaveBeenCalledTimes(1);
    expect(deps.finalizeJob).not.toHaveBeenCalled();
  });

  it('counts a shared stale finalization once across concurrent runs', async () => {
    const finalizedJobs = new Set<number>();
    const deps = dependencies({
      selectStaleExpired: vi.fn().mockResolvedValue([staleExpiredJob]),
      finalizeJob: vi.fn().mockImplementation(async (jobId: number) => {
        if (finalizedJobs.has(jobId)) return null;
        finalizedJobs.add(jobId);
        return { ...staleExpiredJob, id: jobId, artifactKey: null };
      }),
    });

    const [first, second] = await Promise.all([
      runReportExpiryCleanup(50, 'admin-1', deps),
      runReportExpiryCleanup(50, 'admin-1', deps),
    ]);

    expect(first.finalized + second.finalized).toBe(1);
    expect(deps.deleteArtifact).toHaveBeenCalledTimes(2);
  });

  it('retries stale expired jobs that still retain an artifact key', async () => {
    const deps = dependencies({ selectStaleExpired: vi.fn().mockResolvedValue([staleExpiredJob]) });

    await expect(runReportExpiryCleanup(50, 'admin-1', deps)).resolves.toEqual({
      dueCompleted: 0,
      staleExpired: 1,
      staleFailed: 0,
      expired: 0,
      finalized: 1,
      failedDeletions: 0,
    });
    expect(deps.deleteArtifact).toHaveBeenCalledWith('reports/opaque.pdf');
    expect(deps.finalizeJob).toHaveBeenCalledWith(2);
  });

  it('stays coherent when another run finalized a stale job concurrently', async () => {
    const deps = dependencies({
      selectStaleExpired: vi.fn().mockResolvedValue([staleExpiredJob]),
      finalizeJob: vi.fn().mockResolvedValue(null),
    });

    await expect(runReportExpiryCleanup(50, 'admin-1', deps)).resolves.toEqual({
      dueCompleted: 0,
      staleExpired: 1,
      staleFailed: 0,
      expired: 0,
      finalized: 0,
      failedDeletions: 0,
    });
  });

  it('logs and audits only privacy-safe counts', async () => {
    const deps = dependencies({
      selectDueCompleted: vi.fn().mockResolvedValue([completedJob]),
      selectStaleExpired: vi.fn().mockResolvedValue([staleExpiredJob]),
    });

    await runReportExpiryCleanup(50, 'admin-1', deps);
    const logged = JSON.stringify([
      ...vi.mocked(deps.log.info).mock.calls,
      ...vi.mocked(deps.log.error).mock.calls,
    ]);
    expect(logged).not.toContain('reports/');
    expect(logged).not.toContain('admin-1');
    expect(deps.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'report_expiry_cleanup' }),
    );
  });

  it('passes the bounded batch size to all selectors', async () => {
    const deps = dependencies();
    await runReportExpiryCleanup(7, 'admin-1', deps);
    expect(deps.selectDueCompleted).toHaveBeenCalledWith(7);
    expect(deps.selectStaleExpired).toHaveBeenCalledWith(7);
    expect(deps.selectStaleProcessing).toHaveBeenCalledWith(7);
  });

  it('rejects unauthenticated operational access before touching the database', async () => {
    const deps = dependencies({ getSession: vi.fn().mockResolvedValue(null) });

    await expect(runReportExpiryCleanupHandler({ data: {} }, deps)).resolves.toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
    expect(deps.selectDueCompleted).not.toHaveBeenCalled();
  });

  it.each(['student', 'instructor'] as const)('forbids non-admin %s operators', async (role) => {
    const deps = dependencies({
      getSession: vi.fn().mockResolvedValue({ user: { id: 'u-1', role } }),
    });

    await expect(runReportExpiryCleanupHandler({ data: {} }, deps)).resolves.toEqual({
      error: { code: 'FORBIDDEN', message: 'Forbidden' },
    });
    expect(deps.selectDueCompleted).not.toHaveBeenCalled();
  });

  it('runs for an admin operator with the default bounded batch', async () => {
    const deps = dependencies();

    await expect(runReportExpiryCleanupHandler({ data: {} }, deps)).resolves.toEqual({
      summary: {
        dueCompleted: 0,
        staleExpired: 0,
        staleFailed: 0,
        expired: 0,
        finalized: 0,
        failedDeletions: 0,
      },
    });
    expect(deps.selectDueCompleted).toHaveBeenCalledWith(50);
  });

  it('runs for a superadmin operator and honors an explicit batch size', async () => {
    const deps = dependencies({
      getSession: vi.fn().mockResolvedValue({ user: { id: 'sa-1', role: 'superadmin' } }),
    });

    await expect(
      runReportExpiryCleanupHandler({ data: { batchSize: 10 } }, deps),
    ).resolves.toMatchObject({
      summary: expect.objectContaining({ dueCompleted: 0 }),
    });
    expect(deps.selectDueCompleted).toHaveBeenCalledWith(10);
  });
});
