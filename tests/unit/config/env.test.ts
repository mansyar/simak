import { describe, it, expect, beforeEach, vi } from 'vitest';

// We test the env validation logic by re-creating the schema in isolation
// since the module reads from process.env at module level
describe('Environment validation', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  it('should parse valid environment variables successfully', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'simak-uploads';
    process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();

    expect(env.DATABASE_URL).toBe('postgresql://localhost:5432/simak');
    expect(env.BETTER_AUTH_URL).toBe('http://localhost:3000');
  });

  it('should throw on missing DATABASE_URL', async () => {
    delete process.env.DATABASE_URL;
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'simak-uploads';
    process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    // Intentionally leave DATABASE_URL undefined

    const { getEnv } = await import('@/config/env');
    expect(() => getEnv()).toThrow('Environment variable validation failed');
  });

  it('should cache env result on repeated calls', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'simak-uploads';
    process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';

    const { getEnv } = await import('@/config/env');
    const first = getEnv();
    const second = getEnv();
    expect(first).toBe(second);
  });

  it('should throw on invalid DATABASE_URL format', async () => {
    process.env.DATABASE_URL = 'not-a-url';
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'simak-uploads';
    process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';

    const { getEnv } = await import('@/config/env');
    expect(() => getEnv()).toThrow();
  });

  it('should throw error with multiple missing fields', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.SUPERADMIN_EMAIL;

    const { getEnv } = await import('@/config/env');
    try {
      getEnv();
      expect(true).toBe(false); // Shouldn't reach here
    } catch (e) {
      const err = e as Error;
      expect(err.message).toContain('Environment variable validation failed');
      // Verify the .map() error path is exercised (multiple issues formatted)
      expect(err.message).toContain('  -');
    }
  });

  it('should parse valid MIGRATE_DATABASE_URL', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.MIGRATE_DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'simak-uploads';
    process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.MIGRATE_DATABASE_URL).toBe('postgresql://localhost:5432/simak');
  });

  it('should allow MIGRATE_DATABASE_URL to be absent (optional)', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    delete process.env.MIGRATE_DATABASE_URL;
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'simak-uploads';
    process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.MIGRATE_DATABASE_URL).toBeUndefined();
  });

  it('should reject invalid MIGRATE_DATABASE_URL format', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.MIGRATE_DATABASE_URL = 'not-a-url';
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'simak-uploads';
    process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';

    const { getEnv } = await import('@/config/env');
    expect(() => getEnv()).toThrow('MIGRATE_DATABASE_URL');
  });

  it('should throw on missing BETTER_AUTH_SECRET', async () => {
    delete process.env.BETTER_AUTH_SECRET;
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'simak-uploads';
    process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    // Intentionally leave BETTER_AUTH_SECRET undefined

    const { getEnv } = await import('@/config/env');
    expect(() => getEnv()).toThrow('BETTER_AUTH_SECRET');
  });

  it('should reject BETTER_AUTH_SECRET shorter than 32 characters', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'short-secret';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';

    const { getEnv } = await import('@/config/env');
    expect(() => getEnv()).toThrow('BETTER_AUTH_SECRET');
  });

  it('should accept BETTER_AUTH_SECRET of at least 32 characters', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.BETTER_AUTH_SECRET).toBe('test-secret-32-chars-minimum!!!!!');
  });
});
