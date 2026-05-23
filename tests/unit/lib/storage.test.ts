import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the AWS SDK modules before importing the module under test
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function () {
    return {
      config: {
        endpoint: 'https://account.r2.cloudflarestorage.com',
        region: 'auto',
        credentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' },
      },
    };
  }),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://presigned-url.test/upload?token=abc'),
}));

describe('Storage client', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe('generateFileKey', () => {
    it('should return a string matching submissions/{uuid}.pdf pattern', async () => {
      const { generateFileKey } = await import('@/lib/storage');
      const key = generateFileKey('pdf');
      expect(key).toMatch(/^submissions\/[a-f0-9-]+\.pdf$/);
    });

    it('should return a string matching submissions/{uuid}.docx pattern', async () => {
      const { generateFileKey } = await import('@/lib/storage');
      const key = generateFileKey('docx');
      expect(key).toMatch(/^submissions\/[a-f0-9-]+\.docx$/);
    });

    it('should generate unique keys on successive calls', async () => {
      const { generateFileKey } = await import('@/lib/storage');
      const key1 = generateFileKey('pdf');
      const key2 = generateFileKey('pdf');
      expect(key1).not.toBe(key2);
    });
  });

  describe('getR2Client', () => {
    it('should return null when R2 env vars are missing (dev fallback)', async () => {
      // Explicitly clear R2 vars to simulate missing config
      delete process.env.R2_ENDPOINT;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

      const { getR2Client } = await import('@/lib/storage');
      const client = getR2Client();
      expect(client).toBeNull();
    });

    it('should return null when only some R2 env vars are set', async () => {
      process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

      const { getR2Client } = await import('@/lib/storage');
      const client = getR2Client();
      expect(client).toBeNull();
    });

    it('should return configured S3 client when all env vars are present', async () => {
      process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
      process.env.R2_ACCESS_KEY_ID = 'test-key';
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
      process.env.R2_BUCKET_NAME = 'simak-uploads';
      process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

      const { getR2Client } = await import('@/lib/storage');
      const client = getR2Client();
      expect(client).not.toBeNull();

      const { S3Client } = await import('@aws-sdk/client-s3');
      expect(S3Client).toHaveBeenCalled();
    });

    it('should return the same client instance on repeated calls (singleton)', async () => {
      process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
      process.env.R2_ACCESS_KEY_ID = 'test-key';
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
      process.env.R2_BUCKET_NAME = 'simak-uploads';
      process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

      const { getR2Client } = await import('@/lib/storage');
      const first = getR2Client();
      const second = getR2Client();
      expect(first).toBe(second);
    });
  });

  describe('generatePresignedUploadUrl', () => {
    it('should return a URL string when R2 is configured', async () => {
      process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
      process.env.R2_ACCESS_KEY_ID = 'test-key';
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
      process.env.R2_BUCKET_NAME = 'simak-uploads';
      process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

      const { generatePresignedUploadUrl } = await import('@/lib/storage');
      const url = await generatePresignedUploadUrl({
        key: 'submissions/uuid-123.pdf',
        contentType: 'application/pdf',
      });
      expect(url).toBe('https://presigned-url.test/upload?token=abc');
    });

    it('should throw an error when R2 is not configured (no fallback)', async () => {
      delete process.env.R2_ENDPOINT;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

      const { generatePresignedUploadUrl } = await import('@/lib/storage');
      await expect(
        generatePresignedUploadUrl({
          key: 'submissions/uuid-123.pdf',
          contentType: 'application/pdf',
        }),
      ).rejects.toThrow('R2 not configured');
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('should return a URL string when R2 is configured', async () => {
      process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
      process.env.R2_ACCESS_KEY_ID = 'test-key';
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
      process.env.R2_BUCKET_NAME = 'simak-uploads';
      process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

      const { generatePresignedDownloadUrl } = await import('@/lib/storage');
      const url = await generatePresignedDownloadUrl({ key: 'submissions/uuid-123.pdf' });
      expect(url).toBe('https://presigned-url.test/upload?token=abc');
    });

    it('should throw an error when R2 is not configured', async () => {
      delete process.env.R2_ENDPOINT;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

      const { generatePresignedDownloadUrl } = await import('@/lib/storage');
      await expect(
        generatePresignedDownloadUrl({ key: 'submissions/uuid-123.pdf' }),
      ).rejects.toThrow('R2 not configured');
    });
  });

  describe('createStorageService (dev fallback mock)', () => {
    it('should return a service with generatePresignedUploadUrl method in dev fallback', async () => {
      // Clear R2 vars → dev fallback mode
      delete process.env.R2_ENDPOINT;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

      const { createStorageService } = await import('@/lib/storage');
      const service = createStorageService();
      expect(service).toHaveProperty('generatePresignedUploadUrl');
      expect(service).toHaveProperty('generatePresignedDownloadUrl');
    });

    it('should return fake URLs from dev fallback', async () => {
      delete process.env.R2_ENDPOINT;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      process.env.DATABASE_URL = 'postgresql://localhost:5432/simak';

      const { createStorageService } = await import('@/lib/storage');
      const service = createStorageService();
      const uploadUrl = await service.generatePresignedUploadUrl({
        key: 'submissions/uuid-test.pdf',
        contentType: 'application/pdf',
      });
      expect(uploadUrl).toContain('http');
      expect(uploadUrl).toContain('fake-upload');

      const downloadUrl = await service.generatePresignedDownloadUrl({
        key: 'submissions/uuid-test.pdf',
      });
      expect(downloadUrl).toContain('http');
      expect(downloadUrl).toContain('fake-download');
    });
  });
});
