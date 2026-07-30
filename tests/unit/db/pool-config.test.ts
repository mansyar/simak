import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPostgres, mockDrizzle, mockGetEnv, mockLoggerDebug } = vi.hoisted(() => ({
  mockPostgres: vi.fn(),
  mockDrizzle: vi.fn(),
  mockGetEnv: vi.fn(),
  mockLoggerDebug: vi.fn(),
}));

vi.mock('postgres', () => ({
  default: mockPostgres,
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: mockDrizzle,
}));

vi.mock('@/config/env', () => ({
  getEnv: mockGetEnv,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: mockLoggerDebug,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Database pool configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockGetEnv.mockReturnValue({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      DB_POOL_MAX: 10,
      DB_PREPARED_STATEMENTS_DISABLED: false,
    });

    mockPostgres.mockReturnValue({});
    mockDrizzle.mockReturnValue({});
  });

  it('should call postgres() with max equal to env.DB_POOL_MAX (default 10)', async () => {
    const { getDb } = await import('@/db/index');
    getDb();

    expect(mockPostgres).toHaveBeenCalledTimes(1);
    const options = mockPostgres.mock.calls[0]![1];
    expect(options.max).toBe(10);
  });

  it('should call postgres() with idle_timeout: 30', async () => {
    const { getDb } = await import('@/db/index');
    getDb();

    const options = mockPostgres.mock.calls[0]![1];
    expect(options.idle_timeout).toBe(30);
  });

  it('should call postgres() with connect_timeout: 10', async () => {
    const { getDb } = await import('@/db/index');
    getDb();

    const options = mockPostgres.mock.calls[0]![1];
    expect(options.connect_timeout).toBe(10);
  });

  it('should call postgres() with max_lifetime: 1800', async () => {
    const { getDb } = await import('@/db/index');
    getDb();

    const options = mockPostgres.mock.calls[0]![1];
    expect(options.max_lifetime).toBe(1800);
  });

  it('should call postgres() with prepare: true when DB_PREPARED_STATEMENTS_DISABLED is false', async () => {
    const { getDb } = await import('@/db/index');
    getDb();

    const options = mockPostgres.mock.calls[0]![1];
    expect(options.prepare).toBe(true);
  });

  it('should call postgres() with prepare: false when DB_PREPARED_STATEMENTS_DISABLED is true', async () => {
    mockGetEnv.mockReturnValue({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      DB_POOL_MAX: 10,
      DB_PREPARED_STATEMENTS_DISABLED: true,
    });

    const { getDb } = await import('@/db/index');
    getDb();

    const options = mockPostgres.mock.calls[0]![1];
    expect(options.prepare).toBe(false);
  });

  it('should call postgres() with onnotice callback function', async () => {
    const { getDb } = await import('@/db/index');
    getDb();

    const options = mockPostgres.mock.calls[0]![1];
    expect(typeof options.onnotice).toBe('function');
  });

  it('should route PG notices through pino logger at debug level', async () => {
    const { getDb } = await import('@/db/index');
    getDb();

    const options = mockPostgres.mock.calls[0]![1];
    const notice = { code: '00000', message: 'test notice' };
    options.onnotice(notice);

    expect(mockLoggerDebug).toHaveBeenCalledTimes(1);
    expect(mockLoggerDebug).toHaveBeenCalledWith({
      event: 'pg_notice',
      code: '00000',
      message: 'test notice',
    });
  });

  it('should preserve singleton invariant on repeated getDb calls', async () => {
    const { getDb } = await import('@/db/index');
    const first = getDb();
    const second = getDb();

    expect(first).toBe(second);
    expect(mockPostgres).toHaveBeenCalledTimes(1);
  });

  it('should use custom DB_POOL_MAX value from env', async () => {
    mockGetEnv.mockReturnValue({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      DB_POOL_MAX: 25,
      DB_PREPARED_STATEMENTS_DISABLED: false,
    });

    const { getDb } = await import('@/db/index');
    getDb();

    const options = mockPostgres.mock.calls[0]![1];
    expect(options.max).toBe(25);
  });
});
