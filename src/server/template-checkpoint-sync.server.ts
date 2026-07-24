// Server-only helper for checkpoint sync logic (not imported by client code)
import { eq, inArray, and, isNull } from 'drizzle-orm';
import { templateCheckpoints } from '../db/schema/templates';
import { getDb } from '../db/index';

type Db = ReturnType<typeof getDb>;

type CheckpointInput = {
  id?: number;
  name: string;
  minConsultations?: number;
  estimatedDuration?: number;
};

/**
 * Syncs template checkpoints using an upsert/diff approach:
 * - Existing checkpoints (matched by ID) are updated in place (preserving their IDs)
 * - New checkpoints (no ID) are batch-inserted
 * - Removed checkpoints (existing but not in incoming list) are soft-deleted
 *
 * This preserves rubric FKs (rubric_criteria/rubric_levels reference templateCheckpoints.id).
 */
export async function syncTemplateCheckpoints(
  db: Db,
  templateId: number,
  checkpoints: CheckpointInput[],
): Promise<void> {
  const existing = await db
    .select({ id: templateCheckpoints.id })
    .from(templateCheckpoints)
    .where(
      and(eq(templateCheckpoints.templateId, templateId), isNull(templateCheckpoints.deletedAt)),
    );

  const existingIds = new Set(existing.map((c) => c.id));
  const incomingIds = new Set(
    checkpoints.map((c) => c.id).filter((v): v is number => v !== undefined),
  );

  const newRows: Array<{
    templateId: number;
    name: string;
    order: number;
    minConsultations: number;
    estimatedDuration: number;
  }> = [];

  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    const order = i + 1;
    if (cp.id && existingIds.has(cp.id)) {
      await db
        .update(templateCheckpoints)
        .set({
          name: cp.name,
          order,
          minConsultations: cp.minConsultations ?? 0,
          estimatedDuration: cp.estimatedDuration ?? 7,
        })
        .where(eq(templateCheckpoints.id, cp.id));
    } else {
      newRows.push({
        templateId,
        name: cp.name,
        order,
        minConsultations: cp.minConsultations ?? 0,
        estimatedDuration: cp.estimatedDuration ?? 7,
      });
    }
  }

  if (newRows.length > 0) {
    await db.insert(templateCheckpoints).values(newRows);
  }

  const toSoftDelete = existing.filter((c) => !incomingIds.has(c.id));
  if (toSoftDelete.length > 0) {
    await db
      .update(templateCheckpoints)
      .set({ deletedAt: new Date() })
      .where(
        inArray(
          templateCheckpoints.id,
          toSoftDelete.map((c) => c.id),
        ),
      );
  }
}
