import { createHash, randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getBucketName, getR2Client } from '@/lib/storage';

const REPORT_DOWNLOAD_EXPIRY_SECONDS = 300;

export type ReportStorageErrorCode = 'not_configured' | 'not_found' | 'provider_failure';

export class ReportStorageError extends Error {
  constructor(public readonly code: ReportStorageErrorCode) {
    super(
      code === 'not_configured'
        ? 'Report storage is not configured'
        : code === 'not_found'
          ? 'Report artifact not found'
          : 'Report storage failed',
    );
    this.name = 'ReportStorageError';
  }
}

export interface ReportArtifactMetadata {
  artifactKey: string;
  artifactSizeBytes: number;
  artifactSha256: string;
}

function storageContext(): { client: S3Client; bucket: string } {
  const client = getR2Client();
  const bucket = getBucketName();
  if (!client || !bucket) throw new ReportStorageError('not_configured');
  return { client, bucket };
}

function isNotFoundError(error: unknown): boolean {
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  } | null;
  return (
    candidate?.name === 'NotFound' ||
    candidate?.name === 'NoSuchKey' ||
    candidate?.$metadata?.httpStatusCode === 404
  );
}

export async function storeReportArtifact(pdf: Buffer): Promise<ReportArtifactMetadata> {
  const { client, bucket } = storageContext();
  const artifactKey = `reports/${randomUUID()}.pdf`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: artifactKey,
        Body: pdf,
        ContentType: 'application/pdf',
      }),
    );
  } catch {
    throw new ReportStorageError('provider_failure');
  }

  return {
    artifactKey,
    artifactSizeBytes: pdf.byteLength,
    artifactSha256: createHash('sha256').update(pdf).digest('hex'),
  };
}

export async function createReportDownloadUrl(artifactKey: string): Promise<string> {
  const { client, bucket } = storageContext();

  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: artifactKey }));
  } catch (error) {
    throw new ReportStorageError(isNotFoundError(error) ? 'not_found' : 'provider_failure');
  }

  try {
    return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: artifactKey }), {
      expiresIn: REPORT_DOWNLOAD_EXPIRY_SECONDS,
    });
  } catch {
    throw new ReportStorageError('provider_failure');
  }
}

export async function deleteReportArtifact(artifactKey: string): Promise<'deleted' | 'not_found'> {
  const { client, bucket } = storageContext();

  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: artifactKey }));
    return 'deleted';
  } catch (error) {
    if (isNotFoundError(error)) return 'not_found';
    throw new ReportStorageError('provider_failure');
  }
}
