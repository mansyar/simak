import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { serverError, ErrorCode, type ServerError } from './errors';
import { translateKey } from './i18n-server';

/**
 * Generates a UUID-based file key for R2 storage.
 * Format: {prefix}/{uuid}.{extension}
 * Default prefix is 'submissions'.
 */
export function generateFileKey(extension: string, prefix: string = 'submissions'): string {
  const uuid = crypto.randomUUID();
  return `${prefix}/${uuid}.${extension}`;
}

let r2Client: S3Client | null = null;

/**
 * Returns a lazy singleton S3 client configured for Cloudflare R2.
 * Returns null if R2 env vars are not configured (dev fallback).
 */
export function getR2Client(): S3Client | null {
  if (r2Client) return r2Client;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  r2Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // Disable automatic checksum headers that trigger extra CORS preflight
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return r2Client;
}

/**
 * Returns the configured R2 bucket name, or null if not configured.
 */
export function getBucketName(): string | null {
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
 * Result of checking an object's content length in R2.
 * - `{ ok: true, size }` — object exists; `size` is ContentLength in bytes.
 * - `{ ok: false, reason: 'not_configured' }` — R2 env vars not set.
 * - `{ ok: false, reason: 'not_found' }` — object does not exist (404/NotFound).
 */
export type GetObjectContentLengthResult =
  | { ok: true; size: number }
  | { ok: false; reason: 'not_configured' | 'not_found' };

/**
 * Performs an R2 HEAD request for the given key and returns a discriminated
 * result indicating whether the object exists and its content length.
 *
 * - Returns `{ ok: false, reason: 'not_configured' }` if R2 is not configured.
 * - Returns `{ ok: false, reason: 'not_found' }` if the object does not exist (404/NotFound).
 * - Returns `{ ok: true, size }` on success. If ContentLength is missing, `size` defaults to 0.
 * - Other unexpected errors propagate to the caller.
 */
export async function getObjectContentLength(params: {
  key: string;
}): Promise<GetObjectContentLengthResult> {
  const client = getR2Client();
  const bucket = getBucketName();

  if (!client || !bucket) {
    return { ok: false, reason: 'not_configured' };
  }

  const command = new HeadObjectCommand({
    Bucket: bucket,
    Key: params.key,
  });

  try {
    const response = await client.send(command);
    return { ok: true, size: response.ContentLength ?? 0 };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { ok: false, reason: 'not_found' };
    }
    throw error;
  }
}

/**
 * Checks whether an S3 client error represents a "not found" (404) response.
 */
function isNotFoundError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'NotFound') {
    return true;
  }
  const metadata = (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata;
  return metadata?.httpStatusCode === 404;
}

/**
 * Converts a failed R2 size check into a server error with a localized message.
 * Used by submitCheckpointHandler and submitReviewHandler.
 */
export function r2SizeError(
  reason: 'not_configured' | 'not_found',
  locale: 'en' | 'id',
): ServerError {
  const messageKey = reason === 'not_configured' ? 'files.r2NotConfigured' : 'files.objectNotFound';
  return serverError(ErrorCode.BAD_REQUEST, translateKey(messageKey, locale));
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
