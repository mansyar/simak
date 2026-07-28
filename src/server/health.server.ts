import { sql, count, inArray } from 'drizzle-orm';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { getDb } from '@/db/index';
import { getR2Client, getBucketName } from '@/lib/storage';
import { emailQueue } from '@/db/schema/email-queue';
import pkg from '../../package.json';

const CHECK_TIMEOUT_MS = 2000;
const VERSION = pkg.version;

export interface HealthResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: { status: 'ok' | 'error'; error?: string };
    r2: { status: 'ok' | 'not_configured' | 'error'; error?: string };
    emailQueue: { status: 'ok'; depth: number };
  };
}

/**
 * Wraps a promise with a timeout. If the promise does not settle within `ms`
 * milliseconds, the returned promise rejects with `new Error('timeout')`.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

async function checkDatabase(): Promise<HealthResult['checks']['database']> {
  try {
    await withTimeout(getDb().execute(sql`SELECT 1`), CHECK_TIMEOUT_MS);
    return { status: 'ok' };
  } catch {
    return { status: 'error', error: 'database unreachable' };
  }
}

async function checkR2(): Promise<HealthResult['checks']['r2']> {
  const client = getR2Client();
  if (!client) {
    return { status: 'not_configured' };
  }

  const bucket = getBucketName();
  if (!bucket) {
    return { status: 'not_configured' };
  }

  try {
    await withTimeout(client.send(new HeadBucketCommand({ Bucket: bucket })), CHECK_TIMEOUT_MS);
    return { status: 'ok' };
  } catch {
    return { status: 'error', error: 'r2 unreachable' };
  }
}

async function checkEmailQueue(): Promise<HealthResult['checks']['emailQueue']> {
  try {
    const result = await withTimeout(
      getDb()
        .select({ count: count() })
        .from(emailQueue)
        .where(inArray(emailQueue.status, ['pending', 'processing'])),
      CHECK_TIMEOUT_MS,
    );
    return { status: 'ok', depth: Number(result[0]?.count ?? 0) };
  } catch {
    return { status: 'ok', depth: 0 };
  }
}

export async function runHealthChecks(): Promise<HealthResult> {
  const [dbSettled, r2Settled, emailQueueSettled] = await Promise.allSettled([
    checkDatabase(),
    checkR2(),
    checkEmailQueue(),
  ]);

  const database =
    dbSettled.status === 'fulfilled'
      ? dbSettled.value
      : { status: 'error' as const, error: 'database unreachable' };

  const r2 =
    r2Settled.status === 'fulfilled'
      ? r2Settled.value
      : { status: 'error' as const, error: 'r2 unreachable' };

  const emailQueueCheck =
    emailQueueSettled.status === 'fulfilled'
      ? emailQueueSettled.value
      : { status: 'ok' as const, depth: 0 };

  const isHealthy =
    database.status === 'ok' && (r2.status === 'ok' || r2.status === 'not_configured');

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: VERSION,
    checks: {
      database,
      r2,
      emailQueue: emailQueueCheck,
    },
  };
}
