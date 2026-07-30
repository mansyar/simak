/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reclaimAllProcessingRows } from '@/lib/email-queue-processor';
import { getDb } from '@/db/index';
import { emailQueue } from '@/db/schema/index';
import { createMockDb, makeEmail, type MockDb } from './helpers/email-queue-mock';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));

const { mockChildLogger } = vi.hoisted(() => ({
  mockChildLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { child: vi.fn().mockReturnValue(mockChildLogger) },
}));

describe('reclaimAllProcessingRows', () => {
  let mockDb: MockDb;

  function setupDb(rows: ReturnType<typeof makeEmail>[]): void {
    mockDb = createMockDb(rows);
    vi.mocked(getDb).mockReturnValue(mockDb as any);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reclaims all processing rows regardless of age (no time threshold)', async () => {
    const recent = new Date(Date.now() - 30_000);
    const stale = new Date(Date.now() - 10 * 60 * 1000);
    setupDb([
      makeEmail({ id: 1, status: 'processing', lastAttemptAt: recent }),
      makeEmail({ id: 2, status: 'processing', lastAttemptAt: stale }),
      makeEmail({ id: 3, status: 'processing', lastAttemptAt: null }),
    ]);

    const result = await reclaimAllProcessingRows();

    expect(result.reclaimed).toBe(3);
    expect(mockDb.update).toHaveBeenCalledWith(emailQueue);
    const rows = mockDb.getRows();
    expect(rows.filter((r) => r.status === 'processing')).toHaveLength(0);
    expect(rows.filter((r) => r.status === 'pending')).toHaveLength(3);
  });

  it('logs startup_reclaimed event with count', async () => {
    setupDb([
      makeEmail({ id: 1, status: 'processing', lastAttemptAt: new Date() }),
      makeEmail({ id: 2, status: 'processing', lastAttemptAt: null }),
    ]);

    await reclaimAllProcessingRows();

    const reclaimLog = mockChildLogger.info.mock.calls.find(
      ([arg]: any[]) => arg?.event === 'email_queue.startup_reclaimed',
    );
    expect(reclaimLog).toBeTruthy();
    expect(reclaimLog![0]).toMatchObject({
      event: 'email_queue.startup_reclaimed',
      count: 2,
    });
  });

  it('returns { reclaimed: 0 } when no processing rows exist', async () => {
    setupDb([makeEmail({ id: 1, status: 'pending' }), makeEmail({ id: 2, status: 'sent' })]);

    const result = await reclaimAllProcessingRows();

    expect(result.reclaimed).toBe(0);
    const reclaimLog = mockChildLogger.info.mock.calls.find(
      ([arg]: any[]) => arg?.event === 'email_queue.startup_reclaimed',
    );
    expect(reclaimLog).toBeUndefined();
  });
});
