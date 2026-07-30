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
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';

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
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';
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
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';

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
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';

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
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';

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
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';

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
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';

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
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';
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
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';

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
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.BETTER_AUTH_SECRET).toBe('test-secret-32-chars-minimum!!!!!');
  });

  it('should return EMAIL_FROM from env when set', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    process.env.EMAIL_FROM = 'Custom Sender <noreply@custom.app>';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();

    expect(env.EMAIL_FROM).toBe('Custom Sender <noreply@custom.app>');
  });

  it('should default EMAIL_FROM to SIMAK default when unset', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    delete process.env.EMAIL_FROM;

    const { getEnv } = await import('@/config/env');
    const env = getEnv();

    expect(env.EMAIL_FROM).toBe('SIMAK <noreply@simak.app>');
  });

  it('should reject empty EMAIL_FROM', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    process.env.EMAIL_FROM = '';

    const { getEnv } = await import('@/config/env');
    expect(() => getEnv()).toThrow('EMAIL_FROM cannot be empty');
  });

  it('should accept valid EMAIL_FROM', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    process.env.EMAIL_FROM = 'SIMAK <noreply@simak.app>';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.EMAIL_FROM).toBe('SIMAK <noreply@simak.app>');
  });

  it('should default DB_POOL_MAX to 10 when unset', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    delete process.env.DB_POOL_MAX;

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.DB_POOL_MAX).toBe(10);
  });

  it('should coerce DB_POOL_MAX string to number', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    process.env.DB_POOL_MAX = '20';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.DB_POOL_MAX).toBe(20);
  });

  it('should reject DB_POOL_MAX of 0 (must be positive)', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    process.env.DB_POOL_MAX = '0';

    const { getEnv } = await import('@/config/env');
    expect(() => getEnv()).toThrow();
  });

  it('should reject negative DB_POOL_MAX', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    process.env.DB_POOL_MAX = '-5';

    const { getEnv } = await import('@/config/env');
    expect(() => getEnv()).toThrow();
  });

  it('should reject non-numeric DB_POOL_MAX', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    process.env.DB_POOL_MAX = 'abc';

    const { getEnv } = await import('@/config/env');
    expect(() => getEnv()).toThrow();
  });

  it('should default DB_PREPARED_STATEMENTS_DISABLED to false when unset', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    delete process.env.DB_PREPARED_STATEMENTS_DISABLED;

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.DB_PREPARED_STATEMENTS_DISABLED).toBe(false);
  });

  it('should parse DB_PREPARED_STATEMENTS_DISABLED=true to boolean true', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    process.env.DB_PREPARED_STATEMENTS_DISABLED = 'true';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.DB_PREPARED_STATEMENTS_DISABLED).toBe(true);
  });

  it('should parse DB_PREPARED_STATEMENTS_DISABLED=false to boolean false (not z.coerce.boolean)', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    process.env.DB_PREPARED_STATEMENTS_DISABLED = 'false';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.DB_PREPARED_STATEMENTS_DISABLED).toBe(false);
  });

  it('should default SHUTDOWN_TIMEOUT_MS to 10000 when unset', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    delete process.env.SHUTDOWN_TIMEOUT_MS;

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.SHUTDOWN_TIMEOUT_MS).toBe(10000);
  });

  it('should coerce SHUTDOWN_TIMEOUT_MS string to number', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';
    process.env.RESEND_API_KEY = 're_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret-32-chars-minimum!!!!!';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.SUPERADMIN_EMAIL = 'superadmin@simak.local';
    process.env.SUPERADMIN_PASSWORD = 'super-secret-password';
    process.env.SHUTDOWN_TIMEOUT_MS = '5000';

    const { getEnv } = await import('@/config/env');
    const env = getEnv();
    expect(env.SHUTDOWN_TIMEOUT_MS).toBe(5000);
  });
});
