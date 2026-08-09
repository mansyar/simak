/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import {
  completeReportJob,
  expireReportJob,
  failReportJob,
  retryReportJob,
  startReportJob,
} from '@/lib/report-job-transitions.server';

function mockDb(result: unknown[]) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { db: { update } as never, update, set, where };
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

  it('expires only completed jobs whose expiry is due and clears the object key', async () => {
    const { db, set } = mockDb([{ id: 7, state: 'expired' }]);
    await expireReportJob(7, { db, now });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'expired', artifactKey: null, updatedAt: now }),
    );
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
    expect(update).not.toHaveBeenCalled();
  });
});
