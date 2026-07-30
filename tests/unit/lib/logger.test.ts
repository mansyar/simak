/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { getEnv } from '@/config/env';

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    RESEND_API_KEY: 'test-key',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    SUPERADMIN_EMAIL: 'test@test.com',
    SUPERADMIN_PASSWORD: 'password123',
    EMAIL_FROM: 'test@test.com',
    DB_POOL_MAX: 10,
    DB_PREPARED_STATEMENTS_DISABLED: false,
    SHUTDOWN_TIMEOUT_MS: 10000,
  },
}));

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue(mockEnv),
}));

import { createLogger } from '@/lib/logger';

describe('createLogger', () => {
  const originalProd = import.meta.env.PROD;

  afterEach(() => {
    import.meta.env.PROD = originalProd;
    vi.mocked(getEnv).mockReturnValue(mockEnv);
  });

  function createCaptureStream() {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer | string, _encoding: string, callback: () => void) {
        chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
        callback();
      },
    });
    return { stream, getOutput: () => chunks.join('') };
  }

  describe('production mode (JSON output)', () => {
    beforeEach(() => {
      import.meta.env.PROD = true;
    });

    it('outputs JSON with level, time, pid, and msg fields', () => {
      const { stream, getOutput } = createCaptureStream();
      const logger = createLogger({ stream });

      logger.info('test message');

      const output = getOutput().trim();
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('level');
      expect(parsed).toHaveProperty('time');
      expect(parsed).toHaveProperty('pid');
      expect(parsed).toHaveProperty('msg');
      expect(parsed.msg).toBe('test message');
    });

    it('outputs error level (50) for logger.error', () => {
      const { stream, getOutput } = createCaptureStream();
      const logger = createLogger({ stream });

      logger.error('error occurred');

      const output = getOutput().trim();
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe(50);
      expect(parsed.msg).toBe('error occurred');
    });
  });

  describe('development mode (pretty output)', () => {
    beforeEach(() => {
      import.meta.env.PROD = false;
    });

    it('outputs human-readable text (not raw JSON)', async () => {
      const { stream, getOutput } = createCaptureStream();
      const logger = createLogger({ stream });

      logger.info('pretty message');

      // Allow async stream processing to complete
      await new Promise((resolve) => setImmediate(resolve));

      const output = getOutput();
      expect(output).toContain('pretty message');
      expect(() => JSON.parse(output.trim())).toThrow();
    });
  });

  describe('LOG_LEVEL configuration', () => {
    beforeEach(() => {
      import.meta.env.PROD = true;
    });

    it('respects LOG_LEVEL=debug — allows debug messages', () => {
      vi.mocked(getEnv).mockReturnValue({ ...mockEnv, LOG_LEVEL: 'debug' });
      const { stream, getOutput } = createCaptureStream();
      const logger = createLogger({ stream });

      logger.debug('debug message');

      const output = getOutput();
      expect(output).toContain('debug message');
    });

    it('respects LOG_LEVEL=error — suppresses info messages', () => {
      vi.mocked(getEnv).mockReturnValue({ ...mockEnv, LOG_LEVEL: 'error' });
      const { stream, getOutput } = createCaptureStream();
      const logger = createLogger({ stream });

      logger.info('info message');

      const output = getOutput();
      expect(output).toBe('');
    });
  });

  describe('logger methods', () => {
    it('exposes info, error, and warn methods', () => {
      import.meta.env.PROD = true;
      const { stream } = createCaptureStream();
      const logger = createLogger({ stream });

      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
    });
  });
});
