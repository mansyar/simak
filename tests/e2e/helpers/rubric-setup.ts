/**
 * Rubric setup helper for E2E tests.
 *
 * Provides utilities to set up rubric criteria directly in the database
 * for testing the rubric grading flow without going through the admin UI.
 */
import postgres from 'postgres';
import { getDatabaseUrl } from './db-reset';

export interface RubricCriterion {
  id: number;
  title: string;
  weight: number;
}

/**
 * Get the template_checkpoint_id for a checkpoint by name.
 * Returns the first match from template_checkpoints.
 */
export async function getTemplateCheckpointId(checkpointName: string): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`
    SELECT id FROM template_checkpoints
    WHERE name = ${checkpointName} AND deleted_at IS NULL
    LIMIT 1
  `;
  await sql.end();
  if (!row) throw new Error(`Template checkpoint "${checkpointName}" not found`);
  return row.id;
}

/**
 * Set up a numeric rubric on a template checkpoint.
 *
 * Updates the template checkpoint's grading_type to 'numeric' and inserts
 * the given criteria into rubric_criteria. Weights must sum to 100.
 *
 * Returns the created criteria with their DB IDs (for use in score input selectors).
 */
export async function setupNumericRubric(
  templateCheckpointId: number,
  criteria: Array<{ title: string; weight: number; description?: string }>,
): Promise<RubricCriterion[]> {
  const sql = postgres(getDatabaseUrl());

  // Set grading_type to 'numeric'
  await sql`
    UPDATE template_checkpoints SET grading_type = 'numeric'
    WHERE id = ${templateCheckpointId}
  `;

  // Insert criteria
  const created: RubricCriterion[] = [];
  for (let i = 0; i < criteria.length; i++) {
    const c = criteria[i];
    const [row] = await sql`
      INSERT INTO rubric_criteria (template_checkpoint_id, title, description, weight, "order")
      VALUES (${templateCheckpointId}, ${c.title}, ${c.description ?? null}, ${c.weight}, ${i})
      RETURNING id, title, weight
    `;
    created.push(row);
  }

  await sql.end();
  return created;
}

/**
 * Link assignment-level checkpoints to their template checkpoint.
 *
 * The seed script doesn't set `template_checkpoint_id` on checkpoints,
 * so we need to do it manually for the rubric to be loaded during review.
 */
export async function linkCheckpointsToTemplate(
  checkpointName: string,
  templateCheckpointId: number,
  studentEmail = 'student@e2e.test',
): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  await sql`
    UPDATE checkpoints SET template_checkpoint_id = ${templateCheckpointId}
    WHERE name = ${checkpointName}
    AND student_id = (SELECT id FROM users WHERE email = ${studentEmail})
  `;
  await sql.end();
}
