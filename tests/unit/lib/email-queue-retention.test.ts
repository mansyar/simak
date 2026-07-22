import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { pruneOldEmails } from '@/lib/email-queue-retention';
import { getDb } from '@/db/index';
import { emailQueue } from '@/db/schema/index';
import { createMockDb, makeEmail, type MockDb, type FakeRow } from './helpers/email-queue-mock';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('email-queue-retention', () => {
  let mockDb: MockDb;

  function setupDb(rows: FakeRow[]): void {
    mockDb = createMockDb(rows);
    vi.mocked(getDb).mockReturnValue(mockDb as any);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  describe('pruneOldEmails', () => {
    it('deletes sent rows older than 90 days', async () => {
      const oldDate = new Date(Date.now() - 91 * MS_PER_DAY);
      setupDb([
        makeEmail({ id: 1, status: 'sent', createdAt: oldDate }),
        makeEmail({ id: 2, status: 'sent', createdAt: new Date() }),
      ]);

      const result = await pruneOldEmails();

      expect(result.deleted).toBe(1);
      expect(mockDb.delete).toHaveBeenCalledWith(emailQueue);
    });

    it('deletes failed rows older than 180 days', async () => {
      const oldDate = new Date(Date.now() - 181 * MS_PER_DAY);
      setupDb([
        makeEmail({ id: 1, status: 'failed', createdAt: oldDate }),
        makeEmail({ id: 2, status: 'failed', createdAt: new Date() }),
      ]);

      const result = await pruneOldEmails();

      expect(result.deleted).toBe(1);
    });

    it('never deletes pending or processing rows', async () => {
      const veryOldDate = new Date(Date.now() - 365 * MS_PER_DAY);
      setupDb([
        makeEmail({ id: 1, status: 'pending', createdAt: veryOldDate }),
        makeEmail({ id: 2, status: 'processing', createdAt: veryOldDate }),
      ]);

      const result = await pruneOldEmails();

      expect(result.deleted).toBe(0);
    });

    it('does not delete recently sent/failed rows within retention window', async () => {
      const recentSent = new Date(Date.now() - 10 * MS_PER_DAY);
      const recentFailed = new Date(Date.now() - 100 * MS_PER_DAY);
      setupDb([
        makeEmail({ id: 1, status: 'sent', createdAt: recentSent }),
        makeEmail({ id: 2, status: 'failed', createdAt: recentFailed }),
      ]);

      const result = await pruneOldEmails();

      expect(result.deleted).toBe(0);
    });
  });
});
