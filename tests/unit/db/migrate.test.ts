import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockMigrate = vi.fn().mockResolvedValue(undefined);
const sequence: string[] = [];
let executeCallNum = 0;

const mockDbExecute = vi.fn().mockImplementation(() => {
  executeCallNum++;
  sequence.push(executeCallNum === 1 ? 'lock' : 'unlock');
  return Promise.resolve([{}]);
});

vi.mock('drizzle-orm/postgres-js/migrator', () => ({
  migrate: mockMigrate,
}));

vi.mock('postgres', () => ({
  default: vi.fn(() => ({
    end: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({
    execute: mockDbExecute,
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
    executeCallNum = 0;
    sequence.length = 0;

    mockMigrate.mockReset();
    mockMigrate.mockResolvedValue(undefined);

    mockDbExecute.mockReset();
    mockDbExecute.mockImplementation(() => {
      executeCallNum++;
      sequence.push(executeCallNum === 1 ? 'lock' : 'unlock');
      return Promise.resolve([{}]);
    });
  });

  it('should export the correct advisory lock ID constant', async () => {
    const { ADVISORY_LOCK_ID } = await loadMigrate();
    expect(ADVISORY_LOCK_ID).toBe(789123);
  });

  it('should acquire pg_advisory_lock, then call migrate(), then release pg_advisory_unlock on success', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    delete process.env.MIGRATE_DATABASE_URL;

    const postgresModule = await import('postgres');
    const { runMigrations } = await loadMigrate();
    await runMigrations();

    expect(postgresModule.default).toHaveBeenCalledWith('postgresql://localhost:5432/simak', {
      max: 1,
      onnotice: expect.any(Function),
    });
    expect(mockMigrate).toHaveBeenCalledTimes(1);
    expect(mockMigrate).toHaveBeenCalledWith(expect.anything(), {
      migrationsFolder: './drizzle/migrations',
    });
    expect(sequence).toEqual(['lock', 'migrate', 'unlock']);
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

  it('should release pg_advisory_unlock in finally block even when migrate() throws', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    delete process.env.MIGRATE_DATABASE_URL;

    mockMigrate.mockImplementationOnce(() => {
      throw new Error('Migration failed');
    });

    const { runMigrations } = await loadMigrate();
    await expect(runMigrations()).rejects.toThrow('Migration failed');

    expect(sequence).toEqual(['lock', 'unlock']);
    expect(mockMigrate).toHaveBeenCalledTimes(1);
  });
});
