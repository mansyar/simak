/** @vitest-environment node */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import { reportJobs, users } from '@/db/schema/index';
import {
  completeReportJob,
  expireReportJob,
  failReportJob,
  finalizeExpiredReportJob,
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
        parameters: {
          termId: null,
          courseId: null,
          sectionId: null,
          cohort: null,
        },
        locale: 'en',
      })
      .returning();
    return job!;
  }

  async function createCompletedDueJob() {
    const job = await createJob();
    await startReportJob(job.id);
    await completeReportJob(job.id, {
      artifactKey: `reports/${crypto.randomUUID()}.pdf`,
      artifactSizeBytes: 256,
      artifactSha256: 'a'.repeat(64),
    });
    await db
      .update(reportJobs)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(reportJobs.id, job.id));
    const [due] = await db.select().from(reportJobs).where(eq(reportJobs.id, job.id));
    return due!;
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

  it('expires a due completed job while retaining the artifact key', async () => {
    const job = await createCompletedDueJob();

    const expired = await expireReportJob(job.id);
    expect(expired).toMatchObject({
      state: 'expired',
      artifactKey: job.artifactKey,
      artifactSizeBytes: 256,
      artifactSha256: 'a'.repeat(64),
    });

    const [row] = await db.select().from(reportJobs).where(eq(reportJobs.id, job.id));
    expect(row!.state).toBe('expired');
    expect(row!.artifactKey).toBe(job.artifactKey);
  });

  it('refuses to expire a completed job that is not yet due', async () => {
    const job = await createJob();
    await startReportJob(job.id);
    await completeReportJob(job.id, {
      artifactKey: `reports/${crypto.randomUUID()}.pdf`,
      artifactSizeBytes: 256,
      artifactSha256: 'a'.repeat(64),
    });

    await expect(expireReportJob(job.id)).resolves.toBeNull();
  });

  it('allows only one concurrent worker to expire a due completed job', async () => {
    const job = await createCompletedDueJob();

    const expirations = await Promise.all([expireReportJob(job.id), expireReportJob(job.id)]);
    expect(expirations.filter(Boolean)).toHaveLength(1);
    expect(expirations.find(Boolean)).toMatchObject({ state: 'expired' });
  });

  it('clears retained artifact metadata atomically when finalizing an expired job', async () => {
    const job = await createCompletedDueJob();
    await expireReportJob(job.id);

    const finalized = await finalizeExpiredReportJob(job.id);
    expect(finalized).toMatchObject({
      state: 'expired',
      artifactKey: null,
      artifactSizeBytes: null,
      artifactSha256: null,
    });
  });

  it('refuses to finalize jobs that have no retained artifact key', async () => {
    const job = await createCompletedDueJob();
    await expireReportJob(job.id);
    await finalizeExpiredReportJob(job.id);

    await expect(finalizeExpiredReportJob(job.id)).resolves.toBeNull();
  });

  it('allows only one concurrent worker to finalize an expired job', async () => {
    const job = await createCompletedDueJob();
    await expireReportJob(job.id);

    const finalizations = await Promise.all([
      finalizeExpiredReportJob(job.id),
      finalizeExpiredReportJob(job.id),
    ]);
    expect(finalizations.filter(Boolean)).toHaveLength(1);
    expect(finalizations.find(Boolean)).toMatchObject({ artifactKey: null });
  });
});
