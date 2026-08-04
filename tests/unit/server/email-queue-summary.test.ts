/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { getEmailQueueSummaryHandler } from '@/server/email-queue.server';
import type { ServerError } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

describe('getEmailQueueSummaryHandler authorization', () => {
  it('rejects an unauthorized request before querying the database', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const result = (await getEmailQueueSummaryHandler()) as ServerError;

    expect(result).toHaveProperty('error');
    expect(result.error.code).toBe('UNAUTHORIZED');
    expect(dbMod.getDb).not.toHaveBeenCalled();
  });
});
