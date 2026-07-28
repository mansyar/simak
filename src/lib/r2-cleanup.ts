import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { uploadIntents } from '@/db/schema/submissions';
import { safeAuditLog } from '@/lib/audit';
import { getBucketName, getR2Client } from '@/lib/storage';

const BATCH_SIZE = 50;

export async function processOrphanedR2Objects(): Promise<{
  deleted: number;
  failed: number;
  batchSize: number;
}> {
  const client = getR2Client();
  const bucket = getBucketName();

  if (!client || !bucket) {
    return { deleted: 0, failed: 0, batchSize: 0 };
  }

  const db = getDb();

  const orphanedIntents = await db
    .select({ fileKey: uploadIntents.fileKey })
    .from(uploadIntents)
    .where(
      and(
        isNull(uploadIntents.consumedAt),
        lt(uploadIntents.expiresAt, new Date()),
        isNull(uploadIntents.cleanedUpAt),
      ),
    )
    .limit(BATCH_SIZE);

  if (orphanedIntents.length === 0) {
    return { deleted: 0, failed: 0, batchSize: 0 };
  }

  const results = await Promise.allSettled(
    orphanedIntents.map(async (intent) => {
      try {
        const command = new DeleteObjectCommand({
          Bucket: bucket,
          Key: intent.fileKey,
        });
        await client.send(command);
        await db
          .update(uploadIntents)
          .set({ cleanedUpAt: new Date() })
          .where(eq(uploadIntents.fileKey, intent.fileKey));
      } catch (err) {
        console.error({
          event: 'r2_cleanup_failed',
          fileKey: intent.fileKey,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }),
  );

  const deleted = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  await safeAuditLog('r2-cleanup', {
    actorId: 'system',
    action: 'r2.cleanup',
    entityType: 'upload_intent',
    entityId: 'batch',
    details: { deleted, failed, batchSize: orphanedIntents.length },
  });

  return { deleted, failed, batchSize: orphanedIntents.length };
}
