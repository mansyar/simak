/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import {
  completeReportJob,
  expireReportJob,
  failReportJob,
  finalizeExpiredReportJob,
  retryReportJob,
  selectDueCompletedJobs,
  selectStaleExpiredJobs,
  startReportJob,
} from '@/lib/report-job-transitions.server';

function mockDb(result: unknown[]) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { db: { update } as never, update, set, where };
}

function mockSelect(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { db: { select } as never, select, from, where, orderBy, limit };
}

describe('report job transitions', () => {
  const now = new Date('2026-08-09T12:00:00.000Z');

  it('claims a pending job once and increments its attempt count', async () => {
    const row = { id: 7, state: 'processing', attempts: 1 };
    const { db, set } = mockDb([row]);

    await expect(startReportJob(7, { db, now })).resolves.toEqual(row);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'processing', startedAt: now, updatedAt: now }),
    );
  });

  it('returns null for a stale guarded update', async () => {
    const { db } = mockDb([]);
    await expect(startReportJob(7, { db, now })).resolves.toBeNull();
  });

  it('completes only a processing job with artifact metadata and 30-day expiry', async () => {
    const row = { id: 7, state: 'completed' };
    const { db, set } = mockDb([row]);

    await expect(
      completeReportJob(
        7,
        { artifactKey: 'reports/opaque.pdf', artifactSizeBytes: 128, artifactSha256: 'abc' },
        { db, now },
      ),
    ).resolves.toEqual(row);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'completed',
        completedAt: now,
        expiresAt: new Date('2026-09-08T12:00:00.000Z'),
      }),
    );
  });

  it('records a safe failure only from processing', async () => {
    const { db, set } = mockDb([{ id: 7, state: 'failed' }]);
    await failReportJob(7, { code: 'render_failed', message: 'Generation failed' }, { db, now });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failed',
        failureCode: 'render_failed',
        failureMessage: 'Generation failed',
        failedAt: now,
      }),
    );
  });

  it('resets terminal metadata when retrying a failed job', async () => {
    const { db, set } = mockDb([{ id: 7, state: 'pending' }]);
    await retryReportJob(7, { db, now });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'pending',
        startedAt: null,
        failedAt: null,
        failureCode: null,
        failureMessage: null,
      }),
    );
  });

  it('expires only due completed jobs while retaining the artifact key for deletion', async () => {
    const { db, set } = mockDb([{ id: 7, state: 'expired', artifactKey: 'reports/opaque.pdf' }]);
    await expireReportJob(7, { db, now });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ state: 'expired', updatedAt: now }));
    expect(set.mock.calls[0][0]).not.toHaveProperty('artifactKey');
  });

  it('clears retained artifact metadata when finalizing an expired job', async () => {
    const { db, set } = mockDb([{ id: 7, state: 'expired', artifactKey: null }]);
    await finalizeExpiredReportJob(7, { db, now });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactKey: null,
        artifactSizeBytes: null,
        artifactSha256: null,
        updatedAt: now,
      }),
    );
  });

  it('selects due completed jobs in ascending expiry order with a bound', async () => {
    const { db, where, limit } = mockSelect([{ id: 7, state: 'completed' }]);
    await expect(selectDueCompletedJobs(25, { db, now })).resolves.toEqual([
      { id: 7, state: 'completed' },
    ]);
    expect(where).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(25);
  });

  it('selects stale expired jobs that still retain an artifact key', async () => {
    const { db, limit } = mockSelect([{ id: 7, state: 'expired', artifactKey: 'reports/a.pdf' }]);
    await expect(selectStaleExpiredJobs(10, { db })).resolves.toEqual([
      { id: 7, state: 'expired', artifactKey: 'reports/a.pdf' },
    ]);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it('rejects invalid transition input before touching the database', async () => {
    const { db, update } = mockDb([]);
    await expect(
      completeReportJob(
        7,
        { artifactKey: '', artifactSizeBytes: 0, artifactSha256: '' },
        { db, now },
      ),
    ).rejects.toThrow('Invalid report artifact metadata');
    await expect(finalizeExpiredReportJob(0, { db })).rejects.toThrow('Invalid report job ID');
    await expect(selectDueCompletedJobs(0, { db })).rejects.toThrow('Invalid batch limit');
    await expect(selectStaleExpiredJobs(-1, { db })).rejects.toThrow('Invalid batch limit');
    expect(update).not.toHaveBeenCalled();
  });
});
