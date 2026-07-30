/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockClient } = vi.hoisted(() => ({
  mockClient: { end: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('postgres', () => ({
  default: vi.fn(() => mockClient),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({})),
}));

vi.mock('@/config/env', () => ({
  getEnv: vi.fn(() => ({
    DATABASE_URL: 'postgresql://localhost:5432/simak',
    DB_POOL_MAX: 10,
    DB_PREPARED_STATEMENTS_DISABLED: false,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn() },
}));

vi.mock('@/db/schema/index', () => ({}));

describe('db/index', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('closeDb is a no-op when getDb was never called', async () => {
    const { closeDb } = await import('@/db/index');
    expect(() => closeDb()).not.toThrow();
  });

  it('closeDb calls client.end() after getDb was called', async () => {
    const { getDb, closeDb } = await import('@/db/index');
    getDb();
    await closeDb();
    expect(mockClient.end).toHaveBeenCalledTimes(1);
  });

  it('closeDb resets singleton so subsequent getDb creates a fresh connection', async () => {
    const postgres = (await import('postgres')).default;
    const { getDb, closeDb } = await import('@/db/index');

    getDb();
    await closeDb();
    getDb();

    expect(postgres).toHaveBeenCalledTimes(2);
  });
});
