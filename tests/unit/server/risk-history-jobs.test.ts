/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recordRiskObservation, safeAuditLog } = vi.hoisted(() => ({
  recordRiskObservation: vi.fn(),
  safeAuditLog: vi.fn(),
}));

vi.mock('@/server/risk-observation-recorder.server', () => ({ recordRiskObservation }));
vi.mock('@/lib/audit', () => ({ safeAuditLog }));

import {
  processDailyRiskSnapshots,
  processRiskObservationRetention,
} from '@/server/risk-history-jobs.server';

function selectDb(rows: unknown[]) {
  const query = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return { db: { select: vi.fn(() => query) }, query };
}

describe('risk history scheduled processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordRiskObservation.mockResolvedValue({ created: true, observationId: 1 });
  });

  it('records a bounded daily snapshot batch for active assignment students', async () => {
    const { db, query } = selectDb([
      { assignmentId: 11, studentId: 'student-1' },
      { assignmentId: 12, studentId: 'student-2' },
    ]);
    const now = new Date('2026-08-10T05:30:00.000Z');

    const result = await processDailyRiskSnapshots({ db: db as never, now, batchSize: 2 });

    expect(query.limit).toHaveBeenCalledWith(2);
    expect(recordRiskObservation).toHaveBeenNthCalledWith(1, db, {
      source: 'daily_snapshot',
      idempotencyKey: 'risk-observation:daily:2026-08-10:11:student-1',
      assignmentId: 11,
      studentId: 'student-1',
      actorId: 'system:risk-history-daily',
      observedAt: now,
    });
    expect(result).toEqual({ scanned: 2, created: 2, hasMore: true });
  });

  it('is retry-safe when daily observations already exist', async () => {
    const { db } = selectDb([{ assignmentId: 11, studentId: 'student-1' }]);
    recordRiskObservation.mockResolvedValue({ created: false });

    await expect(
      processDailyRiskSnapshots({
        db: db as never,
        now: new Date('2026-08-10T23:59:59.000Z'),
      }),
    ).resolves.toEqual({ scanned: 1, created: 0, hasMore: false });
  });

  it('propagates snapshot failures so the scheduler can retry', async () => {
    const { db } = selectDb([{ assignmentId: 11, studentId: 'student-1' }]);
    recordRiskObservation.mockRejectedValue(new Error('database unavailable'));

    await expect(processDailyRiskSnapshots({ db: db as never })).rejects.toThrow(
      'database unavailable',
    );
  });

  it('anonymizes an expired bounded batch and removes reconstructable detail', async () => {
    const { db, query } = selectDb([{ id: 41 }, { id: 42 }]);
    const updateWhere = vi.fn().mockResolvedValue({ rowCount: 2 });
    const set = vi.fn(() => ({ where: updateWhere }));
    Object.assign(db, { update: vi.fn(() => ({ set })) });
    const now = new Date('2026-08-10T05:30:00.000Z');

    const result = await processRiskObservationRetention({
      db: db as never,
      now,
      batchSize: 2,
    });

    expect(query.limit).toHaveBeenCalledWith(2);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: null,
        studentId: null,
        checkpointId: null,
        interventionId: null,
        eventType: null,
        sourceEventId: null,
        factorSnapshot: [],
        retentionState: 'anonymized',
        anonymizedAt: now,
      }),
    );
    expect(result).toEqual({ scanned: 2, anonymized: 2, hasMore: true });
    expect(safeAuditLog).toHaveBeenCalledWith(
      'risk_observation.retention_anonymized',
      expect.objectContaining({
        actorId: 'system:risk-history-retention',
        details: { anonymizedCount: 2 },
      }),
    );
  });

  it('uses the five-year cutoff and does nothing when no observations expire', async () => {
    const { db, query } = selectDb([]);

    await expect(
      processRiskObservationRetention({
        db: db as never,
        now: new Date('2026-08-10T05:30:00.000Z'),
      }),
    ).resolves.toEqual({ scanned: 0, anonymized: 0, hasMore: false });

    expect(query.where).toHaveBeenCalled();
    expect(safeAuditLog).not.toHaveBeenCalled();
  });

  it('propagates retention failures without auditing incomplete work', async () => {
    const { db } = selectDb([{ id: 41 }]);
    Object.assign(db, {
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockRejectedValue(new Error('update failed')) })),
      })),
    });

    await expect(processRiskObservationRetention({ db: db as never })).rejects.toThrow(
      'update failed',
    );
    expect(safeAuditLog).not.toHaveBeenCalled();
  });
});
