import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
/**
 * Generates a UUID-based file key for R2 storage.
 * Format: {prefix}/{uuid}.{extension}
 * Default prefix is 'submissions'.
 */
export function generateFileKey(extension, prefix = 'submissions') {
  const uuid = crypto.randomUUID();
  return `${prefix}/${uuid}.${extension}`;
}
let r2Client = null;
/**
 * Returns a lazy singleton S3 client configured for Cloudflare R2.
 * Returns null if R2 env vars are not configured (dev fallback).
 */
export function getR2Client() {
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
function getBucketName() {
  return process.env.R2_BUCKET_NAME ?? null;
}
/**
 * Generates a presigned PUT URL for uploading a file to R2.
 * Throws if R2 is not configured.
 */
export async function generatePresignedUploadUrl(params) {
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
export async function generatePresignedDownloadUrl(params) {
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
export function createStorageService() {
  const client = getR2Client();
  if (client) {
    return {
      generatePresignedUploadUrl,
      generatePresignedDownloadUrl,
    };
  }
  // Dev fallback: return fake URLs
  return {
    async generatePresignedUploadUrl(params) {
      return `https://fake-upload.example.com/${params.key}`;
    },
    async generatePresignedDownloadUrl(params) {
      return `https://fake-download.example.com/${params.key}`;
    },
  };
}
