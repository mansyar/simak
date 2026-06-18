import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockExecSync = vi.fn().mockReturnValue(Buffer.from('migrations applied'));

vi.mock('node:child_process', () => ({
  default: { execSync: mockExecSync },
  execSync: mockExecSync,
}));

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

async function loadMigrate() {
  vi.resetModules();
  return await import('@/db/migrate');
}

describe('Migration Runner', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    mockExecSync.mockReset();
    mockExecSync.mockReturnValue(Buffer.from('migrations applied'));
  });

  it('should export the correct advisory lock ID constant', async () => {
    const { ADVISORY_LOCK_ID } = await loadMigrate();
    expect(ADVISORY_LOCK_ID).toBe(789123);
  });

  it('should acquire pg_advisory_lock then shell out to drizzle-kit migrate', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    delete process.env.MIGRATE_DATABASE_URL;

    const postgresModule = await import('postgres');
    const { runMigrations } = await loadMigrate();
    await runMigrations();

    expect(postgresModule.default).toHaveBeenCalledWith('postgresql://localhost:5432/simak', {
      max: 1,
      onnotice: expect.any(Function),
    });
    expect(mockExecSync).toHaveBeenCalledWith('npx drizzle-kit migrate', {
      stdio: 'inherit',
    });
  });

  it('should use MIGRATE_DATABASE_URL when set', async () => {
    process.env.MIGRATE_DATABASE_URL = 'postgresql://localhost:5432/simak_migrate';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

    const postgresModule = await import('postgres');
    const { runMigrations } = await loadMigrate();
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
    const { runMigrations } = await loadMigrate();
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

    const { runMigrations } = await loadMigrate();

    await expect(runMigrations()).rejects.toThrow('process.exit(1)');

    expect(processExit).toHaveBeenCalledWith(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('DATABASE_URL'),
      expect.any(String),
    );

    processExit.mockRestore();
    consoleError.mockRestore();
  });

  it('should release pg_advisory_unlock in finally block even when execSync throws', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    delete process.env.MIGRATE_DATABASE_URL;

    mockExecSync.mockImplementationOnce(() => {
      throw new Error('Command failed: npx drizzle-kit migrate');
    });

    const { runMigrations } = await loadMigrate();
    await expect(runMigrations()).rejects.toThrow('Command failed: npx drizzle-kit migrate');
  });
});
