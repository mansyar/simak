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

  it('uses the intended trigram index with representative data', async () => {
    const rollbackMarker = 'ROLLBACK_SEARCH_QUERY_PLAN_FIXTURES';

    try {
      await db.transaction(async (transaction) => {
        await transaction.execute(sql`
        INSERT INTO "users" ("id", "name", "email", "role", "locale", "email_verified")
        VALUES ('query-plan-instructor', 'Query Plan Instructor', 'query-plan-instructor@example.com', 'instructor', 'en', false)
        ON CONFLICT ("id") DO NOTHING
      `);
        await transaction.execute(sql`
        INSERT INTO "users" ("id", "name", "email", "role", "locale", "email_verified")
        SELECT
          'query-plan-user-' || series,
          CASE WHEN series % 100 = 0 THEN 'performance user ' || series ELSE 'ordinary user ' || series END,
          'query-plan-' || series || '@example.com',
          'student',
          'en',
          false
        FROM generate_series(1, 100000) AS series
      `);
        await transaction.execute(sql`
        INSERT INTO "assignment_templates" ("type", "name")
        SELECT
          'Research',
          CASE WHEN series % 100 = 0 THEN 'performance template ' || series ELSE 'ordinary template ' || series END
        FROM generate_series(1, 100000) AS series
      `);
        await transaction.execute(sql`
        INSERT INTO "email_queue" ("recipient_email", "subject", "body_html", "template_type", "status")
        SELECT
          'query-plan-' || series || '@example.com',
          CASE WHEN series % 100 = 0 THEN 'performance subject ' || series ELSE 'ordinary subject ' || series END,
          '<p>Query-plan fixture</p>',
          'password_reset',
          'sent'
        FROM generate_series(1, 100000) AS series
      `);
        await transaction.execute(sql`
        INSERT INTO "assignments" ("template_id", "title", "final_deadline", "instructor_id")
        SELECT
          (SELECT "id" FROM "assignment_templates" WHERE "name" LIKE 'performance template %' LIMIT 1),
          CASE WHEN series % 100 = 0 THEN 'performance assignment ' || series ELSE 'ordinary assignment ' || series END,
          NOW() + INTERVAL '30 days',
          'query-plan-instructor'
        FROM generate_series(1, 100000) AS series
      `);
        await transaction.execute(sql`
        INSERT INTO "feedback_snippets" ("id", "instructor_id", "title", "category", "body")
        SELECT
          'query-plan-snippet-' || series,
          'query-plan-instructor',
          CASE WHEN series % 100 = 0 THEN 'performance title ' || series ELSE 'ordinary title ' || series END,
          CASE WHEN series % 100 = 0 THEN 'performance category' ELSE 'ordinary category' END,
          'Query-plan fixture body'
        FROM generate_series(1, 100000) AS series
      `);
        await transaction.execute(sql`
        INSERT INTO "audit_log" ("actor_id", "action", "entity_type", "entity_id", "details")
        SELECT
          'query-plan-instructor',
          'query_plan',
          'assignment',
          'query-plan-entity-' || series,
          jsonb_build_object(
            'message', CASE WHEN series % 100 = 0 THEN 'performance details' ELSE 'ordinary details' END
          )
        FROM generate_series(1, 100000) AS series
      `);
        await transaction.execute(sql`
        ANALYZE "users", "assignment_templates", "email_queue", "assignments",
          "feedback_snippets", "audit_log"
      `);
        // Match the low random I/O cost commonly used for SSD-backed production databases
        // while keeping the planner's normal scan selection enabled.
        await transaction.execute(sql`SET LOCAL random_page_cost = 1.1`);

        for (const { description, indexName, query } of cases) {
          const result = await transaction.execute(query);
          const plan = parseExplainPlan(result[0] as Record<string, unknown>);

          expect(containsIndex(plan, indexName), `${description}: ${JSON.stringify(plan)}`).toBe(
            true,
          );
        }

        throw new Error(rollbackMarker);
      });
    } catch (error) {
      if (error instanceof Error && error.message === rollbackMarker) return;
      throw error;
    }
  });
});
