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
});
