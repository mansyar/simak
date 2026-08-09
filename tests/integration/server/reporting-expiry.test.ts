/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { reportJobs, users } from '@/db/schema/index';
import {
  completeReportJob,
  expireReportJob,
  startReportJob,
} from '@/lib/report-job-transitions.server';
import {
  runReportExpiryCleanup,
  type ExpiryCleanupDependencies,
} from '@/server/reporting-expiry.server';

const db = getDb();
const requesterId = `report-expiry-${randomUUID()}`;

async function createCompletedDueJob(): Promise<{ id: number; artifactKey: string }> {
  const [job] = await db
    .insert(reportJobs)
    .values({
      reportType: 'analytics_summary',
      requesterId,
      parameters: { termId: null, courseId: null, sectionId: null, cohort: null },
      locale: 'en',
    })
    .returning();
  await startReportJob(job!.id);
  await completeReportJob(job!.id, {
    artifactKey: `reports/${randomUUID()}.pdf`,
    artifactSizeBytes: 256,
    artifactSha256: 'a'.repeat(64),
  });
  await db
    .update(reportJobs)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(reportJobs.id, job!.id));
  const [due] = await db.select().from(reportJobs).where(eq(reportJobs.id, job!.id));
  return { id: due!.id, artifactKey: due!.artifactKey! };
}

function realDependencies(deleted: string[]): ExpiryCleanupDependencies {
  return {
    getSession: async () => null,
    selectDueCompleted: async (limit) => {
      const { selectDueCompletedJobs } = await import('@/lib/report-job-transitions.server');
      return selectDueCompletedJobs(limit);
    },
    selectStaleExpired: async (limit) => {
      const { selectStaleExpiredJobs } = await import('@/lib/report-job-transitions.server');
      return selectStaleExpiredJobs(limit);
    },
    expireJob: expireReportJob,
    deleteArtifact: async (artifactKey) => {
      deleted.push(artifactKey);
      return 'deleted';
    },
    finalizeJob: async (jobId) => {
      const { finalizeExpiredReportJob } = await import('@/lib/report-job-transitions.server');
      return finalizeExpiredReportJob(jobId);
    },
    audit: async () => undefined,
    log: { info: () => undefined, error: () => undefined },
  };
}

describe('report expiry cleanup (PostgreSQL)', () => {
  beforeAll(async () => {
    await db.delete(reportJobs).where(like(reportJobs.requesterId, 'report-%'));
    await db.insert(users).values({
      id: requesterId,
      email: `${requesterId}@example.com`,
      name: 'Expiry Tester',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await db.delete(reportJobs).where(eq(reportJobs.requesterId, requesterId));
    await db.delete(users).where(eq(users.id, requesterId));
  });

  it('expires, deletes, and finalizes due completed jobs in one bounded run', async () => {
    const due = await createCompletedDueJob();
    const deleted: string[] = [];

    const summary = await runReportExpiryCleanup(10, 'admin-1', realDependencies(deleted));

    expect(summary).toMatchObject({ dueCompleted: 1, expired: 1, finalized: 1 });
    expect(deleted).toEqual([due.artifactKey]);

    const [row] = await db.select().from(reportJobs).where(eq(reportJobs.id, due.id));
    expect(row!.state).toBe('expired');
    expect(row!.artifactKey).toBeNull();
    expect(row!.artifactSha256).toBeNull();
  });

  it('keeps the artifact key on failure and completes deletion on a retry run', async () => {
    const due = await createCompletedDueJob();
    const deleted: string[] = [];
    let providerDown = true;
    const failingDeps = {
      ...realDependencies(deleted),
      deleteArtifact: async (artifactKey: string): Promise<'deleted' | 'not_found'> => {
        if (providerDown) throw new Error('R2 unavailable');
        deleted.push(artifactKey);
        return 'deleted';
      },
    };

    const first = await runReportExpiryCleanup(10, 'admin-1', failingDeps);
    expect(first).toMatchObject({ expired: 1, finalized: 0, failedDeletions: 1 });
    expect(deleted).toEqual([]);

    const [afterFailure] = await db.select().from(reportJobs).where(eq(reportJobs.id, due.id));
    expect(afterFailure!.state).toBe('expired');
    expect(afterFailure!.artifactKey).toBe(due.artifactKey);

    providerDown = false;
    const second = await runReportExpiryCleanup(10, 'admin-1', failingDeps);
    expect(second).toMatchObject({ staleExpired: 1, finalized: 1, failedDeletions: 0 });
    expect(deleted).toEqual([due.artifactKey]);

    const [afterRetry] = await db.select().from(reportJobs).where(eq(reportJobs.id, due.id));
    expect(afterRetry!.state).toBe('expired');
    expect(afterRetry!.artifactKey).toBeNull();
  });

  it('finalizes a shared stale row exactly once across concurrent runs', async () => {
    const due = await createCompletedDueJob();
    await expireReportJob(due.id);
    const deleted: string[] = [];

    const [first, second] = await Promise.all([
      runReportExpiryCleanup(10, 'admin-1', realDependencies(deleted)),
      runReportExpiryCleanup(10, 'admin-1', realDependencies(deleted)),
    ]);

    expect(first.finalized + second.finalized).toBe(1);
    expect(deleted.filter((key) => key === due.artifactKey).length).toBeGreaterThanOrEqual(1);

    const [row] = await db.select().from(reportJobs).where(eq(reportJobs.id, due.id));
    expect(row!.state).toBe('expired');
    expect(row!.artifactKey).toBeNull();
  });

  it('tolerates an already-missing object and still finalizes', async () => {
    const due = await createCompletedDueJob();

    const summary = await runReportExpiryCleanup(10, 'admin-1', {
      ...realDependencies([]),
      deleteArtifact: async (): Promise<'deleted' | 'not_found'> => 'not_found',
    });

    expect(summary).toMatchObject({ expired: 1, finalized: 1, failedDeletions: 0 });

    const [row] = await db.select().from(reportJobs).where(eq(reportJobs.id, due.id));
    expect(row!.artifactKey).toBeNull();
  });

  it('leaves not-yet-due completed jobs untouched', async () => {
    const [job] = await db
      .insert(reportJobs)
      .values({
        reportType: 'analytics_summary',
        requesterId,
        parameters: { termId: null, courseId: null, sectionId: null, cohort: null },
        locale: 'en',
      })
      .returning();
    await startReportJob(job!.id);
    await completeReportJob(job!.id, {
      artifactKey: `reports/${randomUUID()}.pdf`,
      artifactSizeBytes: 256,
      artifactSha256: 'a'.repeat(64),
    });

    await runReportExpiryCleanup(10, 'admin-1', realDependencies([]));

    const [row] = await db.select().from(reportJobs).where(eq(reportJobs.id, job!.id));
    expect(row!.state).toBe('completed');
    expect(row!.artifactKey).not.toBeNull();
  });
});
