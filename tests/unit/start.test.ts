/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @tanstack/react-start so importing src/start.ts doesn't fail
vi.mock('@tanstack/react-start', () => ({
  createStart: vi.fn((opts) => ({ getOptions: opts })),
  createMiddleware: vi.fn(() => ({
    server: vi.fn((fn) => fn),
  })),
  createCsrfMiddleware: vi.fn(() => ({})),
}));

vi.mock('@tanstack/react-start/server', () => ({
  setResponseHeader: vi.fn(),
}));

vi.mock('@/lib/security-headers', () => ({
  generateNonce: vi.fn(() => 'test-nonce-1234'),
  buildSecurityHeaders: vi.fn(() => ({
    'Content-Security-Policy': "default-src 'self'",
  })),
}));

import { getR2Domain } from '@/start';

describe('getR2Domain', () => {
  const originalEnv = process.env.R2_ENDPOINT;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.R2_ENDPOINT;
    } else {
      process.env.R2_ENDPOINT = originalEnv;
    }
  });

  it('returns hostname for valid R2_ENDPOINT URL', () => {
    process.env.R2_ENDPOINT = 'https://r2.example.com/bucket';
    expect(getR2Domain()).toBe('r2.example.com');
  });

  it('returns hostname for R2_ENDPOINT with port', () => {
    process.env.R2_ENDPOINT = 'https://localhost:9000/bucket';
    expect(getR2Domain()).toBe('localhost');
  });

  it('returns undefined when R2_ENDPOINT is not set', () => {
    delete process.env.R2_ENDPOINT;
    expect(getR2Domain()).toBeUndefined();
  });

  it('returns undefined when R2_ENDPOINT is empty string', () => {
    process.env.R2_ENDPOINT = '';
    expect(getR2Domain()).toBeUndefined();
  });

  it('returns undefined for invalid URL', () => {
    process.env.R2_ENDPOINT = 'not-a-url';
    expect(getR2Domain()).toBeUndefined();
  });
});
