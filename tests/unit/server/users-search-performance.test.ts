/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { listUsersHandler } from '@/server/users.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));

describe('listUsers search query workload', () => {
  it('starts the count query without waiting for searched page rows', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'superadmin' } as any,
      session: {} as any,
    });

    let releaseRows: (() => void) | undefined;
    let countStarted = false;
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      then: vi
        .fn()
        .mockImplementationOnce(
          (onfulfilled: any) =>
            new Promise((resolve) => {
              releaseRows = () => resolve(onfulfilled([]));
            }),
        )
        .mockImplementationOnce((onfulfilled: any) => {
          countStarted = true;
          return Promise.resolve([{ count: 0 }]).then(onfulfilled);
        }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);

    const pending = listUsersHandler({ data: { page: 2, limit: 20, search: 'needle' } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(countStarted).toBe(true);
    releaseRows?.();
    await pending;
  });
});
