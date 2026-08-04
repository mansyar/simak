/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db/index';

type ExplainNode = Record<string, unknown>;

type SearchPlanCase = {
  description: string;
  indexName: string;
  query: SQL;
};

function containsIndex(plan: unknown, indexName: string): boolean {
  if (Array.isArray(plan)) {
    return plan.some((node) => containsIndex(node, indexName));
  }

  if (!plan || typeof plan !== 'object') return false;

  const node = plan as ExplainNode;
  if (node['Index Name'] === indexName) return true;

  return Object.values(node).some((value) => containsIndex(value, indexName));
}

function parseExplainPlan(row: Record<string, unknown>): unknown {
  const rawPlan = row['QUERY PLAN'];
  return typeof rawPlan === 'string' ? JSON.parse(rawPlan) : rawPlan;
}

describe('search query plans', () => {
  const db = getDb();
  const searchTerm = '%performance%';
  const cases: SearchPlanCase[] = [
    {
      description: 'users.name',
      indexName: 'users_name_trgm_idx',
      query: sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 1 FROM "users" WHERE "name" ILIKE ${searchTerm}`,
    },
    {
      description: 'users.email',
      indexName: 'users_email_trgm_idx',
      query: sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 1 FROM "users" WHERE "email" ILIKE ${searchTerm}`,
    },
    {
      description: 'assignment_templates.name',
      indexName: 'assignment_templates_name_trgm_idx',
      query: sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 1 FROM "assignment_templates" WHERE "name" ILIKE ${searchTerm}`,
    },
    {
      description: 'email_queue.recipient_email',
      indexName: 'email_queue_recipient_email_trgm_idx',
      query: sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 1 FROM "email_queue" WHERE "recipient_email" ILIKE ${searchTerm}`,
    },
    {
      description: 'email_queue.subject',
      indexName: 'email_queue_subject_trgm_idx',
      query: sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 1 FROM "email_queue" WHERE "subject" ILIKE ${searchTerm}`,
    },
    {
      description: 'assignments.title',
      indexName: 'assignments_title_trgm_idx',
      query: sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 1 FROM "assignments" WHERE "title" ILIKE ${searchTerm}`,
    },
    {
      description: 'feedback_snippets.title',
      indexName: 'feedback_snippets_title_trgm_idx',
      query: sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 1 FROM "feedback_snippets" WHERE "title" ILIKE ${searchTerm}`,
    },
    {
      description: 'feedback_snippets.category',
      indexName: 'feedback_snippets_category_trgm_idx',
      query: sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 1 FROM "feedback_snippets" WHERE "category" ILIKE ${searchTerm}`,
    },
    {
      description: 'audit_log.entity_id',
      indexName: 'audit_log_entity_id_trgm_idx',
      query: sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 1 FROM "audit_log" WHERE "entity_id" LIKE ${searchTerm}`,
    },
    {
      description: 'audit_log.details text expression',
      indexName: 'audit_log_details_trgm_idx',
      query: sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 1 FROM "audit_log"
        WHERE CAST("details" AS text) LIKE ${searchTerm}`,
    },
  ];

  it.each(cases)(
    'uses the intended trigram index for $description',
    async ({ indexName, query }) => {
      await db.transaction(async (transaction) => {
        // Small local fixtures often prefer a sequential scan. Disable it only for this
        // eligibility check so the test verifies that each operator-class index is usable.
        await transaction.execute(sql`SET LOCAL enable_seqscan = off`);
        await transaction.execute(sql`SET LOCAL enable_indexscan = off`);
        await transaction.execute(sql`SET LOCAL enable_indexonlyscan = off`);
        const result = await transaction.execute(query);
        const plan = parseExplainPlan(result[0] as Record<string, unknown>);

        expect(containsIndex(plan, indexName), JSON.stringify(plan, null, 2)).toBe(true);
      });
    },
  );
});
