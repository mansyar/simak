/** @vitest-environment node */
import { describe, it, expect, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class MockS3Client {
    send = mocks.send;
  },
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

import { getObjectContentLength } from '@/lib/storage';

describe('getObjectContentLength', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    mocks.send.mockReset();
  });

  // Must run first: the module-level r2Client singleton is null at load time,
  // so getR2Client() re-checks env vars. Once a client is created (in later tests)
  // it is cached and env-var changes no longer take effect.
  it('returns null when R2 is not configured', async () => {
    delete process.env.R2_ENDPOINT;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;

    const result = await getObjectContentLength({ key: 'test-key' });

    expect(result).toBeNull();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('returns the ContentLength on a successful HEAD request', async () => {
    process.env.R2_ENDPOINT = 'https://test.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'test-bucket';

    mocks.send.mockResolvedValueOnce({ ContentLength: 2048 });

    const result = await getObjectContentLength({ key: 'submissions/file.txt' });

    expect(result).toBe(2048);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('returns null when the response omits ContentLength', async () => {
    // r2Client is cached from the previous test; env vars are irrelevant now.
    mocks.send.mockResolvedValueOnce({});

    const result = await getObjectContentLength({ key: 'submissions/empty.txt' });

    expect(result).toBeNull();
  });
});
