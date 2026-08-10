/** @vitest-environment node */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getSignedUrl: vi.fn(),
  getR2Client: vi.fn(),
  getBucketName: vi.fn(),
  putInputs: [] as unknown[],
  headInputs: [] as unknown[],
  getInputs: [] as unknown[],
  deleteInputs: [] as unknown[],
}));

vi.mock('@/lib/storage', () => ({
  getR2Client: mocks.getR2Client,
  getBucketName: mocks.getBucketName,
}));

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: class {
    constructor(input: unknown) {
      mocks.putInputs.push(input);
    }
  },
  HeadObjectCommand: class {
    constructor(input: unknown) {
      mocks.headInputs.push(input);
    }
  },
  GetObjectCommand: class {
    constructor(input: unknown) {
      mocks.getInputs.push(input);
    }
  },
  DeleteObjectCommand: class {
    constructor(input: unknown) {
      mocks.deleteInputs.push(input);
    }
  },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mocks.getSignedUrl }));

import {
  createReportDownloadUrl,
  deleteReportArtifact,
  ReportStorageError,
  storeReportArtifact,
} from '@/server/report-storage.server';

describe('private report storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.putInputs.length = 0;
    mocks.headInputs.length = 0;
    mocks.getInputs.length = 0;
    mocks.deleteInputs.length = 0;
    mocks.getR2Client.mockReturnValue({ send: mocks.send });
    mocks.getBucketName.mockReturnValue('private-bucket');
    mocks.send.mockResolvedValue({});
  });

  it('uploads a PDF under an opaque UUID key and returns persistence metadata', async () => {
    const pdf = Buffer.from('private transcript for student@example.com');

    const result = await storeReportArtifact(pdf);

    expect(result).toEqual({
      artifactKey: expect.stringMatching(
        /^reports\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/,
      ),
      artifactSizeBytes: pdf.byteLength,
      artifactSha256: createHash('sha256').update(pdf).digest('hex'),
    });
    expect(result.artifactKey).not.toMatch(/transcript|student|example|@/i);
    expect(mocks.putInputs).toEqual([
      {
        Bucket: 'private-bucket',
        Key: result.artifactKey,
        Body: pdf,
        ContentType: 'application/pdf',
      },
    ]);
  });

  it('rejects durable uploads when R2 is not configured', async () => {
    mocks.getR2Client.mockReturnValue(null);

    await expect(storeReportArtifact(Buffer.from('pdf'))).rejects.toMatchObject({
      name: 'ReportStorageError',
      code: 'not_configured',
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('HEAD-checks an artifact and presigns its GET for five minutes', async () => {
    mocks.getSignedUrl.mockResolvedValue('https://signed.example/report');

    await expect(createReportDownloadUrl('reports/opaque.pdf')).resolves.toBe(
      'https://signed.example/report',
    );

    expect(mocks.headInputs).toEqual([{ Bucket: 'private-bucket', Key: 'reports/opaque.pdf' }]);
    expect(mocks.getInputs).toEqual([
      {
        Bucket: 'private-bucket',
        Key: 'reports/opaque.pdf',
        ResponseContentDisposition: 'attachment',
      },
    ]);
    expect(mocks.getSignedUrl).toHaveBeenCalledWith({ send: mocks.send }, expect.anything(), {
      expiresIn: 300,
    });
  });

  it('distinguishes a missing artifact without exposing provider details', async () => {
    mocks.send.mockRejectedValueOnce(
      Object.assign(new Error('sensitive provider response'), {
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      }),
    );

    const error = await createReportDownloadUrl('reports/missing.pdf').catch((value) => value);

    expect(error).toBeInstanceOf(ReportStorageError);
    expect(error).toMatchObject({ code: 'not_found', message: 'Report artifact not found' });
    expect(error.message).not.toContain('sensitive');
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['upload', () => storeReportArtifact(Buffer.from('pdf'))],
    ['head', () => createReportDownloadUrl('reports/opaque.pdf')],
  ])('maps %s provider failures to a safe storage error', async (_operation, invoke) => {
    mocks.send.mockRejectedValueOnce(new Error('provider secret'));

    const error = await invoke().catch((value) => value);

    expect(error).toBeInstanceOf(ReportStorageError);
    expect(error).toMatchObject({ code: 'provider_failure', message: 'Report storage failed' });
    expect(error.message).not.toContain('secret');
  });

  it('maps presigner failures to a safe storage error', async () => {
    mocks.getSignedUrl.mockRejectedValueOnce(new Error('signing secret'));

    await expect(createReportDownloadUrl('reports/opaque.pdf')).rejects.toMatchObject({
      code: 'provider_failure',
      message: 'Report storage failed',
    });
  });

  it('deletes artifacts and reports already-missing objects idempotently', async () => {
    await expect(deleteReportArtifact('reports/opaque.pdf')).resolves.toBe('deleted');
    expect(mocks.deleteInputs).toEqual([{ Bucket: 'private-bucket', Key: 'reports/opaque.pdf' }]);

    mocks.send.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { $metadata: { httpStatusCode: 404 } }),
    );
    await expect(deleteReportArtifact('reports/missing.pdf')).resolves.toBe('not_found');
  });
});
