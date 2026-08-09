/** @vitest-environment node */
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Db, getDb } from '@/db/index';
import { reportJobs, users } from '@/db/schema';

const rollbackSql = readFileSync(
  resolve(process.cwd(), 'drizzle/migrations/rollback/0032_little_moon_knight.rollback.sql'),
  'utf8',
);
const forwardSql = readFileSync(
  resolve(process.cwd(), 'drizzle/migrations/0032_little_moon_knight.sql'),
  'utf8',
);

describe('report job expiry constraint forward and rollback semantics', () => {
  const db = getDb();

  async function seedProcessingJob(tx: Db): Promise<number> {
    const userId = `report-constraint-${randomUUID()}`;
    await tx.insert(users).values({
      id: userId,
      email: `${userId}@example.com`,
      name: 'Constraint Tester',
      role: 'admin',
    });
    const [job] = await tx
      .insert(reportJobs)
      .values({
        reportType: 'analytics_summary',
        requesterId: userId,
        parameters: { termId: null, courseId: null, sectionId: null, cohort: null },
        locale: 'en',
        state: 'processing',
        startedAt: new Date(),
      })
      .returning();
    return job!.id;
  }

  const retainKeyUpdate = (jobId: number) => sql`
    UPDATE report_jobs
    SET state = 'expired',
        completed_at = now(),
        expires_at = now(),
        artifact_key = 'reports/retained.pdf',
        artifact_size_bytes = 1,
        artifact_sha256 = 'a'
    WHERE id = ${jobId}
  `;

  it('accepts an expired row that retains its artifact key (forward semantics)', async () => {
    const err = new Error('rollback forward fixture');
    await expect(
      db.transaction(async (tx) => {
        const id = await seedProcessingJob(tx);
        await tx.execute(retainKeyUpdate(id));
        const [row] = await tx.select().from(reportJobs).where(eq(reportJobs.id, id));
        expect(row!.artifactKey).toBe('reports/retained.pdf');
        expect(row!.state).toBe('expired');
        throw err;
      }),
    ).rejects.toBe(err);
  });

  it('rollback SQL restores the null artifact key requirement', async () => {
    const err = new Error('rollback rollback fixture');
    let violated = false;
    try {
      await db.transaction(async (tx) => {
        const id = await seedProcessingJob(tx);
        await tx.execute(sql.raw(rollbackSql));
        try {
          await tx.execute(retainKeyUpdate(id));
        } catch {
          violated = true;
          throw err;
        }
        throw new Error('update unexpectedly succeeded under the restored constraint');
      });
    } catch (e) {
      expect(e).toBe(err);
    }
    expect(violated).toBe(true);
  });

  it('reapplying the forward migration restores retention semantics', async () => {
    const err = new Error('rollback reapply fixture');
    await expect(
      db.transaction(async (tx) => {
        const id = await seedProcessingJob(tx);
        await tx.execute(sql.raw(rollbackSql));
        await tx.execute(sql.raw(forwardSql));
        await tx.execute(retainKeyUpdate(id));
        throw err;
      }),
    ).rejects.toBe(err);
  });
});
