/** @vitest-environment node */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import { reportJobs, users } from '@/db/schema/index';
import {
  completeReportJob,
  failReportJob,
  retryReportJob,
  startReportJob,
} from '@/lib/report-job-transitions.server';

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    DATABASE_URL:
      process.env.MIGRATE_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql://simak:simak_password@localhost:5433/simak_test',
    DB_POOL_MAX: 5,
    DB_PREPARED_STATEMENTS_DISABLED: false,
    LOG_LEVEL: 'info',
  }),
}));

describe('report job transitions integration', () => {
  const db = getDb();
  const requesterId = `report-transition-${crypto.randomUUID()}`;

  beforeAll(async () => {
    await db.insert(users).values({
      id: requesterId,
      name: 'Report Transition Test',
      email: `${requesterId}@example.com`,
      role: 'admin',
    });
  });

  afterAll(async () => {
    await db.delete(reportJobs).where(eq(reportJobs.requesterId, requesterId));
    await db.delete(users).where(eq(users.id, requesterId));
  });

  async function createJob() {
    const [job] = await db
      .insert(reportJobs)
      .values({
        reportType: 'analytics_summary',
        requesterId,
        parameters: {},
        locale: 'en',
      })
      .returning();
    return job!;
  }

  it('allows only one concurrent worker to claim a pending job', async () => {
    const job = await createJob();
    const claims = await Promise.all([startReportJob(job.id), startReportJob(job.id)]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)).toMatchObject({ state: 'processing', attempts: 1 });
  });

  it('persists completion and rejects a stale failure transition', async () => {
    const job = await createJob();
    await startReportJob(job.id);

    const completed = await completeReportJob(job.id, {
      artifactKey: `reports/${crypto.randomUUID()}.pdf`,
      artifactSizeBytes: 256,
      artifactSha256: 'a'.repeat(64),
    });

    expect(completed).toMatchObject({ state: 'completed', artifactSizeBytes: 256 });
    await expect(
      failReportJob(job.id, { code: 'late_failure', message: 'Late failure' }),
    ).resolves.toBeNull();
  });

  it('resets a failed job for a fresh guarded retry', async () => {
    const job = await createJob();
    await startReportJob(job.id);
    await failReportJob(job.id, { code: 'render_failed', message: 'Generation failed' });

    const retried = await retryReportJob(job.id);
    expect(retried).toMatchObject({
      state: 'pending',
      attempts: 1,
      startedAt: null,
      failedAt: null,
      failureCode: null,
    });
  });
});
