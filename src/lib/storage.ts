import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Generates a UUID-based file key for R2 storage.
 * Format: submissions/{uuid}.{extension}
 */
export function generateFileKey(extension: string): string {
  const uuid = crypto.randomUUID();
  return `submissions/${uuid}.${extension}`;
}

let _r2Client: S3Client | null = null;

/**
 * Returns a lazy singleton S3 client configured for Cloudflare R2.
 * Returns null if R2 env vars are not configured (dev fallback).
 */
export function getR2Client(): S3Client | null {
  if (_r2Client) return _r2Client;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  _r2Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // Disable automatic checksum headers that trigger extra CORS preflight
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return _r2Client;
}

/**
 * Returns the configured R2 bucket name, or null if not configured.
 */
function getBucketName(): string | null {
  return process.env.R2_BUCKET_NAME ?? null;
}

/**
 * Generates a presigned PUT URL for uploading a file to R2.
 * Throws if R2 is not configured.
 */
export async function generatePresignedUploadUrl(params: {
  key: string;
  contentType: string;
}): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();

  if (!client || !bucket) {
    throw new Error('R2 not configured');
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
  });

  return getSignedUrl(client, command, { expiresIn: 300 }); // 5 minutes
}

/**
 * Generates a presigned GET URL for downloading a file from R2.
 * Throws if R2 is not configured.
 */
export async function generatePresignedDownloadUrl(params: { key: string }): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();

  if (!client || !bucket) {
    throw new Error('R2 not configured');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: params.key,
  });

  return getSignedUrl(client, command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Creates a storage service with presigned URL generation.
 * In dev fallback mode (R2 not configured), returns fake URLs.
 */
export function createStorageService(): {
  generatePresignedUploadUrl: (params: { key: string; contentType: string }) => Promise<string>;
  generatePresignedDownloadUrl: (params: { key: string }) => Promise<string>;
} {
  const client = getR2Client();

  if (client) {
    return {
      generatePresignedUploadUrl,
      generatePresignedDownloadUrl,
    };
  }

  // Dev fallback: return fake URLs
  return {
    async generatePresignedUploadUrl(params: { key: string; contentType: string }) {
      return `https://fake-upload.example.com/${params.key}`;
    },
    async generatePresignedDownloadUrl(params: { key: string }) {
      return `https://fake-download.example.com/${params.key}`;
    },
  };
}
