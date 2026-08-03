/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enableCalendarFeedHandler,
  getCalendarFeedStatusHandler,
  regenerateCalendarFeedHandler,
  revokeCalendarFeedHandler,
} from '@/server/calendar-feed.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { safeAuditLog } from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  safeAuditLog: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

const { mockTx, mockDb } = vi.hoisted(() => {
  const tx = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    returning: vi.fn(),
  };
  const db = {
    transaction: vi.fn(),
  };

  db.transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) =>
    callback(tx),
  );

  return { mockTx: tx, mockDb: db };
});

const studentSession = {
  user: {
    id: 'student-1',
    role: 'student' as const,
    name: 'Student',
    email: 'student@example.com',
    image: null,
  },
  session: {},
};

function queryResult<T>(value: T) {
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    then: (onfulfilled: (result: T) => unknown) => Promise.resolve(value).then(onfulfilled),
  };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

function returningResult<T>(value: T) {
  const query = {
    values: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
    then: (onfulfilled: (result: T) => unknown) => Promise.resolve(value).then(onfulfilled),
  };
  query.values.mockReturnValue(query);
  query.set.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.returning.mockReturnValue(query);
  return query;
}

function queueAuthorizedStudent() {
  mockTx.select.mockReturnValueOnce(queryResult([{ id: studentSession.user.id }]));
}

describe('calendar feed token lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as never);
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as never);
    mockTx.select.mockReset();
    mockTx.insert.mockReset();
    mockTx.update.mockReset();
    mockDb.transaction.mockReset();
    mockDb.transaction.mockImplementation(
      async (callback: (transaction: typeof mockTx) => unknown) => callback(mockTx),
    );
  });

  it('enables a feed with a high-entropy opaque token and stores only its hash', async () => {
    queueAuthorizedStudent();
    mockTx.select.mockReturnValueOnce(queryResult([]));
    mockTx.insert.mockReturnValueOnce(returningResult([{ id: 'feed-token-1' }]));

    const result = await enableCalendarFeedHandler({ data: {} });

    expect(result).toMatchObject({ enabled: true });
    if ('error' in result || !result.feedUrl) return;

    const token = result.feedUrl.split('token=')[1];
    expect(token).toHaveLength(43);
    const insertQuery = mockTx.insert.mock.results[0]?.value as ReturnType<typeof returningResult>;
    const values = insertQuery.values.mock.calls[0]?.[0] as { tokenHash: string };
    expect(values.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(values.tokenHash).not.toBe(token);
    expect(JSON.stringify(vi.mocked(safeAuditLog).mock.calls)).not.toContain(token);
    expect(vi.mocked(safeAuditLog)).toHaveBeenCalledWith(
      'calendar-feed-enabled',
      expect.objectContaining({ actorId: 'student-1', entityId: 'feed-token-1' }),
    );
  });

  it('does not create a second active token when enablement already exists', async () => {
    queueAuthorizedStudent();
    mockTx.select.mockReturnValueOnce(queryResult([{ id: 'existing-token' }]));

    await expect(enableCalendarFeedHandler({ data: {} })).resolves.toEqual({
      enabled: true,
      feedUrl: null,
    });
    expect(mockTx.insert).not.toHaveBeenCalled();
  });

  it('reports a disabled feed without exposing token material', async () => {
    queueAuthorizedStudent();
    mockTx.select.mockReturnValueOnce(queryResult([]));

    await expect(getCalendarFeedStatusHandler()).resolves.toEqual({ enabled: false });
  });

  it('regenerates inside one transaction and revokes the previous token', async () => {
    queueAuthorizedStudent();
    mockTx.select.mockReturnValueOnce(queryResult([{ id: 'old-token' }]));
    mockTx.update.mockReturnValueOnce(returningResult([{ id: 'old-token' }]));
    mockTx.insert.mockReturnValueOnce(returningResult([{ id: 'new-token' }]));

    const result = await regenerateCalendarFeedHandler({ data: {} });

    expect(result).toMatchObject({ enabled: true });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.update).toHaveBeenCalledTimes(1);
    expect(mockTx.insert).toHaveBeenCalledTimes(1);
    expect(vi.mocked(safeAuditLog)).toHaveBeenCalledWith(
      'calendar-feed-regenerated',
      expect.objectContaining({ actorId: 'student-1', entityId: 'new-token' }),
    );
  });

  it('revokes the active token and returns a disabled state', async () => {
    queueAuthorizedStudent();
    mockTx.update.mockReturnValueOnce(returningResult([{ id: 'active-token' }]));

    await expect(revokeCalendarFeedHandler({ data: {} })).resolves.toEqual({ enabled: false });
    expect(mockTx.update).toHaveBeenCalledTimes(1);
    expect(vi.mocked(safeAuditLog)).toHaveBeenCalledWith(
      'calendar-feed-revoked',
      expect.objectContaining({ actorId: 'student-1', entityId: 'active-token' }),
    );
  });

  it('rejects unauthenticated and non-student lifecycle requests', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValueOnce(null);
    await expect(getCalendarFeedStatusHandler()).resolves.toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValueOnce({
      ...studentSession,
      user: { ...studentSession.user, role: 'instructor' },
    } as never);
    await expect(getCalendarFeedStatusHandler()).resolves.toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
  });

  it('rejects an inactive or deleted student even with a valid session', async () => {
    mockTx.select.mockReturnValueOnce(queryResult([]));

    await expect(getCalendarFeedStatusHandler()).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Calendar feed unavailable' },
    });
  });
});
