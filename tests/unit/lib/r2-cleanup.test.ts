/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ safeAuditLog: vi.fn().mockResolvedValue(undefined) }));

const { r2ClientMock } = vi.hoisted(() => ({
  r2ClientMock: { send: vi.fn() },
}));

vi.mock('@/lib/storage', () => ({
  getR2Client: vi.fn(),
  getBucketName: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: vi.fn(),
}));

import { processOrphanedR2Objects } from '@/lib/r2-cleanup';
import { getDb } from '@/db/index';
import { safeAuditLog } from '@/lib/audit';
import { getR2Client, getBucketName } from '@/lib/storage';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

describe('processOrphanedR2Objects', () => {
  let mockDb: any;
  let mockSelectChain: any;
  let mockUpdateChain: any;

  const orphanedIntents = [
    { fileKey: 'submissions/abc-123.pdf' },
    { fileKey: 'submissions/def-456.docx' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn((onf: any) => Promise.resolve([]).then(onf)),
    };

    mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      then: vi.fn((onf: any) => Promise.resolve(undefined).then(onf)),
    };

    mockDb = {
      select: vi.fn().mockReturnValue(mockSelectChain),
      update: vi.fn().mockReturnValue(mockUpdateChain),
    };

    vi.mocked(getDb).mockReturnValue(mockDb as any);
    vi.mocked(getR2Client).mockReturnValue(r2ClientMock as any);
    vi.mocked(getBucketName).mockReturnValue('test-bucket');
    r2ClientMock.send.mockResolvedValue({});
  });

  it('queries orphaned intents with consumedAt IS NULL, expiresAt < now, cleanedUpAt IS NULL, LIMIT 50', async () => {
    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );

    await processOrphanedR2Objects();

    expect(mockDb.select).toHaveBeenCalledOnce();
    expect(mockSelectChain.from).toHaveBeenCalledOnce();
    expect(mockSelectChain.where).toHaveBeenCalledOnce();
    expect(mockSelectChain.limit).toHaveBeenCalledWith(50);
  });

  it('deletes R2 objects via DeleteObjectCommand with correct Bucket and Key', async () => {
    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );

    await processOrphanedR2Objects();

    expect(DeleteObjectCommand).toHaveBeenCalledTimes(2);
    expect(DeleteObjectCommand).toHaveBeenNthCalledWith(1, {
      Bucket: 'test-bucket',
      Key: 'submissions/abc-123.pdf',
    });
    expect(DeleteObjectCommand).toHaveBeenNthCalledWith(2, {
      Bucket: 'test-bucket',
      Key: 'submissions/def-456.docx',
    });
    expect(r2ClientMock.send).toHaveBeenCalledTimes(2);
  });

  it('sets cleanedUpAt to now() on successful R2 delete', async () => {
    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );

    await processOrphanedR2Objects();

    expect(mockDb.update).toHaveBeenCalledTimes(2);
    expect(mockUpdateChain.set).toHaveBeenCalledTimes(2);
    expect(mockUpdateChain.where).toHaveBeenCalledTimes(2);

    // Verify set was called with a cleanedUpAt Date
    const setCall = mockUpdateChain.set.mock.calls[0][0];
    expect(setCall.cleanedUpAt).toBeInstanceOf(Date);
  });

  it('does NOT set cleanedUpAt on R2 delete failure', async () => {
    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );
    r2ClientMock.send.mockRejectedValueOnce(new Error('R2 delete failed'));

    await processOrphanedR2Objects();

    // Only 1 successful delete -> only 1 update call
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it('returns correct summary { deleted, failed, batchSize }', async () => {
    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );

    const result = await processOrphanedR2Objects();

    expect(result).toEqual({ deleted: 2, failed: 0, batchSize: 2 });
  });

  it('returns correct summary when one delete fails', async () => {
    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );
    r2ClientMock.send.mockRejectedValueOnce(new Error('R2 delete failed'));

    const result = await processOrphanedR2Objects();

    expect(result).toEqual({ deleted: 1, failed: 1, batchSize: 2 });
  });

  it('is a no-op when R2 is not configured (getR2Client returns null)', async () => {
    vi.mocked(getR2Client).mockReturnValue(null);

    const result = await processOrphanedR2Objects();

    expect(result).toEqual({ deleted: 0, failed: 0, batchSize: 0 });
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(safeAuditLog).not.toHaveBeenCalled();
  });

  it('is a no-op when bucket name is null', async () => {
    vi.mocked(getBucketName).mockReturnValue(null);

    const result = await processOrphanedR2Objects();

    expect(result).toEqual({ deleted: 0, failed: 0, batchSize: 0 });
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(safeAuditLog).not.toHaveBeenCalled();
  });

  it('is a no-op when no orphaned intents found', async () => {
    mockSelectChain.then.mockImplementation((onf: any) => Promise.resolve([]).then(onf));

    const result = await processOrphanedR2Objects();

    expect(result).toEqual({ deleted: 0, failed: 0, batchSize: 0 });
    expect(r2ClientMock.send).not.toHaveBeenCalled();
    expect(safeAuditLog).not.toHaveBeenCalled();
  });

  it('uses Promise.allSettled for parallel deletes with per-object error isolation', async () => {
    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );
    // First send fails, second succeeds
    r2ClientMock.send.mockRejectedValueOnce(new Error('Network error'));

    const result = await processOrphanedR2Objects();

    // Both sends were attempted (error isolation)
    expect(r2ClientMock.send).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ deleted: 1, failed: 1, batchSize: 2 });
  });

  it('logs structured error for failed deletes', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );
    r2ClientMock.send.mockRejectedValueOnce(new Error('R2 delete failed'));

    await processOrphanedR2Objects();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'r2_cleanup_failed',
        fileKey: 'submissions/abc-123.pdf',
        error: 'R2 delete failed',
      }),
    );

    consoleSpy.mockRestore();
  });

  it('calls safeAuditLog with correct parameters for background cleanup', async () => {
    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );

    await processOrphanedR2Objects();

    expect(safeAuditLog).toHaveBeenCalledWith('r2-cleanup', {
      actorId: 'system',
      action: 'r2.cleanup',
      entityType: 'upload_intent',
      entityId: 'batch',
      details: { deleted: 2, failed: 0, batchSize: 2 },
    });
  });

  it('calls safeAuditLog with custom actorId when provided', async () => {
    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );

    await processOrphanedR2Objects('admin-42');

    expect(safeAuditLog).toHaveBeenCalledWith('r2-cleanup', {
      actorId: 'admin-42',
      action: 'r2.cleanup',
      entityType: 'upload_intent',
      entityId: 'batch',
      details: { deleted: 2, failed: 0, batchSize: 2 },
    });
  });

  it('calls safeAuditLog with correct parameters when some deletes fail', async () => {
    mockSelectChain.then.mockImplementation((onf: any) =>
      Promise.resolve(orphanedIntents).then(onf),
    );
    r2ClientMock.send.mockRejectedValueOnce(new Error('R2 delete failed'));

    await processOrphanedR2Objects();

    expect(safeAuditLog).toHaveBeenCalledWith('r2-cleanup', {
      actorId: 'system',
      action: 'r2.cleanup',
      entityType: 'upload_intent',
      entityId: 'batch',
      details: { deleted: 1, failed: 1, batchSize: 2 },
    });
  });
});
