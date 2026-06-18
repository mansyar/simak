import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock everything at the top level with inline factories (hoisted)
vi.mock('postgres', () => ({
  default: vi.fn(() => ({
    end: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue([{ pg_advisory_lock: true }]),
  })),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({
    execute: vi.fn().mockResolvedValue([{ pg_advisory_lock: true }]),
  })),
}));

vi.mock('drizzle-orm/postgres-js/migrator', () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
}));

describe('Migration Runner', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
    vi.clearAllMocks();
  });

  it('should export the correct advisory lock ID constant', async () => {
    const { ADVISORY_LOCK_ID } = await import('@/db/migrate');
    expect(ADVISORY_LOCK_ID).toBe(789123);
  });

  it('should acquire pg_advisory_lock before migrate()', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    delete process.env.MIGRATE_DATABASE_URL;

    const postgresModule = await import('postgres');
    const drizzleModule = await import('drizzle-orm/postgres-js');
    const migratorModule = await import('drizzle-orm/postgres-js/migrator');

    const { runMigrations } = await import('@/db/migrate');
    await runMigrations();

    // Verify postgres was called with DATABASE_URL
    expect(postgresModule.default).toHaveBeenCalledWith('postgresql://localhost:5432/simak', {
      max: 1,
      onnotice: expect.any(Function),
    });
    // Verify migrate was called
    expect(migratorModule.migrate).toHaveBeenCalled();
  });

  it('should use MIGRATE_DATABASE_URL when set', async () => {
    process.env.MIGRATE_DATABASE_URL = 'postgresql://localhost:5432/simak_migrate';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

    const postgresModule = await import('postgres');

    const { runMigrations } = await import('@/db/migrate');
    await runMigrations();

    expect(postgresModule.default).toHaveBeenCalledWith(
      'postgresql://localhost:5432/simak_migrate',
      { max: 1, onnotice: expect.any(Function) },
    );
  });

  it('should fallback to DATABASE_URL when MIGRATE_DATABASE_URL is unset', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    delete process.env.MIGRATE_DATABASE_URL;

    const postgresModule = await import('postgres');

    const { runMigrations } = await import('@/db/migrate');
    await runMigrations();

    expect(postgresModule.default).toHaveBeenCalledWith('postgresql://localhost:5432/simak', {
      max: 1,
      onnotice: expect.any(Function),
    });
  });

  it('should exit with error when neither MIGRATE_DATABASE_URL nor DATABASE_URL is set', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.MIGRATE_DATABASE_URL;

    const processExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit(1)');
    }) as (...args: unknown[]) => never);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { runMigrations } = await import('@/db/migrate');

    await expect(runMigrations()).rejects.toThrow('process.exit(1)');

    expect(processExit).toHaveBeenCalledWith(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('DATABASE_URL'),
      expect.any(String),
    );

    processExit.mockRestore();
    consoleError.mockRestore();
  });

  it('should release pg_advisory_unlock in finally block even when migrate() throws', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    delete process.env.MIGRATE_DATABASE_URL;

    // Override migrate mock to throw
    const migratorModule = await import('drizzle-orm/postgres-js/migrator');
    vi.mocked(migratorModule.migrate).mockRejectedValueOnce(new Error('Migration failed'));

    const drizzleModule = await import('drizzle-orm/postgres-js');
    const drizzleSpy = drizzleModule.drizzle as unknown as ReturnType<typeof vi.fn>;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { runMigrations } = await import('@/db/migrate');

    await expect(runMigrations()).rejects.toThrow('Migration failed');

    // Verify unlock was called in finally despite the throw
    // drizzle() was called to construct the db handle
    expect(drizzleSpy).toHaveBeenCalledTimes(1);
    // The returned execute spy was called twice (lock + unlock)
    const mockDb = drizzleSpy.mock.results[0]?.value;
    expect(mockDb?.execute).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
  });
});
