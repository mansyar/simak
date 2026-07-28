/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dbMod from '@/db/index';
import * as storageMod from '@/lib/storage';
import pkg from '../../../package.json';

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  getR2Client: vi.fn(),
  getBucketName: vi.fn(),
}));

import { runHealthChecks } from '@/server/health.server';

describe('runHealthChecks', () => {
  let mockDb: any;
  let mockR2Client: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      then: vi.fn(function (this: any, onfulfilled: any) {
        return Promise.resolve([{ count: 0 }]).then(onfulfilled);
      }),
    };

    mockR2Client = {
      send: vi.fn().mockResolvedValue({}),
    };

    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
    vi.mocked(storageMod.getR2Client).mockReturnValue(null);
    vi.mocked(storageMod.getBucketName).mockReturnValue('test-bucket');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('healthy responses', () => {
    it('returns healthy status with all checks ok when DB up + R2 up', async () => {
      vi.mocked(storageMod.getR2Client).mockReturnValue(mockR2Client as any);

      const result = await runHealthChecks();

      expect(result.status).toBe('healthy');
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.r2.status).toBe('ok');
      expect(result.checks.emailQueue.status).toBe('ok');
      expect(result.checks.emailQueue).toHaveProperty('depth');
      expect(typeof result.checks.emailQueue.depth).toBe('number');
    });

    it('returns healthy status when DB up + R2 not_configured', async () => {
      vi.mocked(storageMod.getR2Client).mockReturnValue(null);

      const result = await runHealthChecks();

      expect(result.status).toBe('healthy');
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.r2.status).toBe('not_configured');
      expect(result.checks.emailQueue.status).toBe('ok');
    });
  });

  describe('unhealthy responses', () => {
    it('returns unhealthy status when DB is down (execute rejects)', async () => {
      mockDb.execute.mockRejectedValue(new Error('Connection refused'));

      const result = await runHealthChecks();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('error');
      expect(result.checks.database).toHaveProperty('error');
      expect(result.checks.database.error).toBe('Connection refused');
    });

    it('returns unhealthy status when R2 configured but HeadBucket fails', async () => {
      vi.mocked(storageMod.getR2Client).mockReturnValue(mockR2Client as any);
      mockR2Client.send.mockRejectedValue(new Error('Access Denied'));

      const result = await runHealthChecks();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.r2.status).toBe('error');
      expect(result.checks.r2).toHaveProperty('error');
      expect(result.checks.r2.error).toBe('Access Denied');
    });
  });

  describe('timeout behavior', () => {
    it('hanging DB dependency resolves to error within 2s timeout', async () => {
      vi.useFakeTimers();

      mockDb.execute.mockReturnValue(new Promise(() => {}));
      vi.mocked(storageMod.getR2Client).mockReturnValue(mockR2Client as any);

      const promise = runHealthChecks();
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('error');
      expect(result.checks.database.error).toBe('timeout');
    });

    it('hanging R2 dependency resolves to error within 2s timeout', async () => {
      vi.useFakeTimers();

      mockR2Client.send.mockReturnValue(new Promise(() => {}));
      vi.mocked(storageMod.getR2Client).mockReturnValue(mockR2Client as any);

      const promise = runHealthChecks();
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result.status).toBe('unhealthy');
      expect(result.checks.r2.status).toBe('error');
      expect(result.checks.r2.error).toBe('timeout');
    });
  });

  describe('email queue depth', () => {
    it('reports depth as a number and never causes unhealthy status', async () => {
      mockDb.then.mockImplementation(function (this: any, onfulfilled: any) {
        return Promise.resolve([{ count: 42 }]).then(onfulfilled);
      });

      const result = await runHealthChecks();

      expect(result.checks.emailQueue.status).toBe('ok');
      expect(result.checks.emailQueue.depth).toBe(42);
      expect(result.status).toBe('healthy');
    });

    it('returns depth 0 when email queue query fails', async () => {
      mockDb.then.mockImplementation(function (this: any, onfulfilled: any, onrejected: any) {
        onrejected(new Error('Query failed'));
        return Promise.resolve();
      });

      const result = await runHealthChecks();

      expect(result.checks.emailQueue.status).toBe('ok');
      expect(result.checks.emailQueue.depth).toBe(0);
    });
  });

  describe('metadata', () => {
    it('version matches package.json version', async () => {
      const result = await runHealthChecks();

      expect(result.version).toBe(pkg.version);
    });

    it('timestamp is a valid ISO 8601 string', async () => {
      const result = await runHealthChecks();

      expect(result.timestamp).toBeTruthy();
      const parsed = new Date(result.timestamp);
      expect(parsed.toISOString()).toBe(result.timestamp);
    });
  });
});
