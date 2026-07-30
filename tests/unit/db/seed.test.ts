import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger to prevent getEnv() call at module load (seed.ts imports @/db/index which imports @/lib/logger)
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Seed script', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export seed function', async () => {
    const mod = await import('@/db/seed');
    expect(mod).toHaveProperty('seedSuperAdmin');
  });

  it('should require SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD env vars', async () => {
    // Clear env vars to test validation
    vi.stubEnv('SUPERADMIN_EMAIL', '');
    vi.stubEnv('SUPERADMIN_PASSWORD', '');
    const mod = await import('@/db/seed');
    await expect(mod.seedSuperAdmin()).rejects.toThrow(/SUPERADMIN_EMAIL|SUPERADMIN_PASSWORD/);
    vi.unstubAllEnvs();
  });

  it('should validate SUPERADMIN_EMAIL format', async () => {
    process.env.SUPERADMIN_EMAIL = 'not-an-email';
    process.env.SUPERADMIN_PASSWORD = 'valid-password-123';
    const mod = await import('@/db/seed');
    await expect(mod.seedSuperAdmin()).rejects.toThrow(/invalid.*email/i);
  });

  it('should validate SUPERADMIN_PASSWORD minimum length', async () => {
    process.env.SUPERADMIN_EMAIL = 'admin@test.com';
    process.env.SUPERADMIN_PASSWORD = 'short';
    const mod = await import('@/db/seed');
    await expect(mod.seedSuperAdmin()).rejects.toThrow(/password.*8|8.*character/i);
  });
});
