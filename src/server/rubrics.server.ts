// Server-only handler implementations (not bundled for client)
import { eq, inArray, and, isNull, asc } from 'drizzle-orm';
import { getDb } from '../db/index';
import { rubricCriteria, rubricLevels } from '../db/schema/rubrics';
import { templateCheckpoints } from '../db/schema/templates';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode } from '../lib/errors';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type {
  SaveRubricSchema,
  DeleteCriterionSchema,
  DeleteLevelSchema,
  GetRubricSchema,
  SaveRubricResult,
  GetRubricResult,
  DeleteResult,
} from './rubrics';

type SaveRubricInput = z.infer<typeof SaveRubricSchema>;
type DeleteCriterionInput = z.infer<typeof DeleteCriterionSchema>;
type DeleteLevelInput = z.infer<typeof DeleteLevelSchema>;
type GetRubricInput = z.infer<typeof GetRubricSchema>;

function isAdmin(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && (session.user.role === 'admin' || session.user.role === 'superadmin');
}

/**
 * Save (create/update/soft-delete) rubric criteria + levels for a template checkpoint.
 * Uses a transaction to ensure atomicity across gradingType update, criteria sync, and levels sync.
 */
export async function saveRubricHandler({
  data,
}: {
  data: SaveRubricInput;
}): Promise<SaveRubricResult> {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { templateCheckpointId, gradingType, criteria, levels } = data;
  const db = getDb();

  try {
    // 1. Verify template checkpoint exists (non-deleted)
    const [checkpoint] = await db
      .select({ id: templateCheckpoints.id })
      .from(templateCheckpoints)
      .where(
        and(
          eq(templateCheckpoints.id, templateCheckpointId),
          isNull(templateCheckpoints.deletedAt),
        ),
      )
      .limit(1);

    if (!checkpoint) {
      return serverError(ErrorCode.NOT_FOUND, 'Template checkpoint not found');
    }

    // 2. Update gradingType + sync criteria/levels in transaction
    await db.transaction(async (tx) => {
      await tx
        .update(templateCheckpoints)
        .set({ gradingType })
        .where(eq(templateCheckpoints.id, templateCheckpointId));

      // If gradingType is null, soft-delete all existing criteria + levels
      if (gradingType === null) {
        await tx
          .update(rubricCriteria)
          .set({ deletedAt: new Date() })
          .where(eq(rubricCriteria.templateCheckpointId, templateCheckpointId));
        await tx
          .update(rubricLevels)
          .set({ deletedAt: new Date() })
          .where(eq(rubricLevels.templateCheckpointId, templateCheckpointId));
        return;
      }

      // Sync criteria (upsert by ID, soft-delete removed)
      const existingCriteria = await tx
        .select({ id: rubricCriteria.id })
        .from(rubricCriteria)
        .where(
          and(
            eq(rubricCriteria.templateCheckpointId, templateCheckpointId),
            isNull(rubricCriteria.deletedAt),
          ),
        );

      const existingCriterionIds = new Set(existingCriteria.map((c) => c.id));
      const incomingCriterionIds = new Set(
        criteria.map((c) => c.id).filter((v): v is number => v !== undefined),
      );

      const newCriteria: Array<{
        templateCheckpointId: number;
        title: string;
        description: string | null;
        weight: number;
        order: number;
      }> = [];

      for (const c of criteria) {
        if (c.id && existingCriterionIds.has(c.id)) {
          await tx
            .update(rubricCriteria)
            .set({
              title: c.title,
              description: c.description ?? null,
              weight: c.weight,
              order: c.order,
            })
            .where(eq(rubricCriteria.id, c.id));
        } else {
          newCriteria.push({
            templateCheckpointId,
            title: c.title,
            description: c.description ?? null,
            weight: c.weight,
            order: c.order,
          });
        }
      }

      if (newCriteria.length > 0) {
        await tx.insert(rubricCriteria).values(newCriteria);
      }

      const toDeleteCriteria = existingCriteria.filter((c) => !incomingCriterionIds.has(c.id));
      if (toDeleteCriteria.length > 0) {
        await tx
          .update(rubricCriteria)
          .set({ deletedAt: new Date() })
          .where(
            inArray(
              rubricCriteria.id,
              toDeleteCriteria.map((c) => c.id),
            ),
          );
      }

      // Sync levels (qualitative only; numeric soft-deletes all levels)
      if (gradingType === 'qualitative') {
        const existingLevels = await tx
          .select({ id: rubricLevels.id })
          .from(rubricLevels)
          .where(
            and(
              eq(rubricLevels.templateCheckpointId, templateCheckpointId),
              isNull(rubricLevels.deletedAt),
            ),
          );

        const existingLevelIds = new Set(existingLevels.map((l) => l.id));
        const incomingLevelIds = new Set(
          levels.map((l) => l.id).filter((v): v is number => v !== undefined),
        );

        const newLevels: Array<{
          templateCheckpointId: number;
          label: string;
          description: string | null;
          score: number;
          order: number;
        }> = [];

        for (const l of levels) {
          if (l.id && existingLevelIds.has(l.id)) {
            await tx
              .update(rubricLevels)
              .set({
                label: l.label,
                description: l.description ?? null,
                score: l.score,
                order: l.order,
              })
              .where(eq(rubricLevels.id, l.id));
          } else {
            newLevels.push({
              templateCheckpointId,
              label: l.label,
              description: l.description ?? null,
              score: l.score,
              order: l.order,
            });
          }
        }

        if (newLevels.length > 0) {
          await tx.insert(rubricLevels).values(newLevels);
        }

        const toDeleteLevels = existingLevels.filter((l) => !incomingLevelIds.has(l.id));
        if (toDeleteLevels.length > 0) {
          await tx
            .update(rubricLevels)
            .set({ deletedAt: new Date() })
            .where(
              inArray(
                rubricLevels.id,
                toDeleteLevels.map((l) => l.id),
              ),
            );
        }
      } else {
        // numeric: soft-delete any existing levels (levels only for qualitative)
        await tx
          .update(rubricLevels)
          .set({ deletedAt: new Date() })
          .where(eq(rubricLevels.templateCheckpointId, templateCheckpointId));
      }
    });

    // 3. Log audit (after commit)
    await logAuditEvent({
      actorId: session.user.id,
      action: 'rubric.saved',
      entityType: 'template_checkpoint',
      entityId: templateCheckpointId.toString(),
      details: {
        gradingType,
        criteriaCount: criteria.length,
        levelsCount: levels.length,
      },
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'saveRubricHandler',
    });
  }
}

/**
 * Get rubric data (gradingType + criteria + levels) for a template checkpoint.
 * Returns non-deleted criteria/levels, ordered by their `order` field.
 */
export async function getRubricHandler({
  data,
}: {
  data: GetRubricInput;
}): Promise<GetRubricResult> {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { templateCheckpointId } = data;
  const db = getDb();

  try {
    const [checkpoint] = await db
      .select({ gradingType: templateCheckpoints.gradingType })
      .from(templateCheckpoints)
      .where(
        and(
          eq(templateCheckpoints.id, templateCheckpointId),
          isNull(templateCheckpoints.deletedAt),
        ),
      )
      .limit(1);

    if (!checkpoint) {
      return serverError(ErrorCode.NOT_FOUND, 'Template checkpoint not found');
    }

    const criteria = await db
      .select({
        id: rubricCriteria.id,
        title: rubricCriteria.title,
        description: rubricCriteria.description,
        weight: rubricCriteria.weight,
        order: rubricCriteria.order,
      })
      .from(rubricCriteria)
      .where(
        and(
          eq(rubricCriteria.templateCheckpointId, templateCheckpointId),
          isNull(rubricCriteria.deletedAt),
        ),
      )
      .orderBy(asc(rubricCriteria.order));

    const levels = await db
      .select({
        id: rubricLevels.id,
        label: rubricLevels.label,
        description: rubricLevels.description,
        score: rubricLevels.score,
        order: rubricLevels.order,
      })
      .from(rubricLevels)
      .where(
        and(
          eq(rubricLevels.templateCheckpointId, templateCheckpointId),
          isNull(rubricLevels.deletedAt),
        ),
      )
      .orderBy(asc(rubricLevels.order));

    return {
      gradingType: checkpoint.gradingType,
      criteria,
      levels,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getRubricHandler',
    });
  }
}

/**
 * Soft-delete a single rubric criterion by ID.
 */
export async function softDeleteCriterionHandler({
  data,
}: {
  data: DeleteCriterionInput;
}): Promise<DeleteResult> {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { id } = data;
  const db = getDb();

  try {
    const [criterion] = await db
      .select({ id: rubricCriteria.id })
      .from(rubricCriteria)
      .where(and(eq(rubricCriteria.id, id), isNull(rubricCriteria.deletedAt)))
      .limit(1);

    if (!criterion) {
      return serverError(ErrorCode.NOT_FOUND, 'Criterion not found');
    }

    await db.update(rubricCriteria).set({ deletedAt: new Date() }).where(eq(rubricCriteria.id, id));

    await logAuditEvent({
      actorId: session.user.id,
      action: 'rubric.criterion_deleted',
      entityType: 'rubric_criterion',
      entityId: id.toString(),
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'softDeleteCriterionHandler',
    });
  }
}

/**
 * Soft-delete a single rubric level by ID.
 */
export async function softDeleteLevelHandler({
  data,
}: {
  data: DeleteLevelInput;
}): Promise<DeleteResult> {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { id } = data;
  const db = getDb();

  try {
    const [level] = await db
      .select({ id: rubricLevels.id })
      .from(rubricLevels)
      .where(and(eq(rubricLevels.id, id), isNull(rubricLevels.deletedAt)))
      .limit(1);

    if (!level) {
      return serverError(ErrorCode.NOT_FOUND, 'Level not found');
    }

    await db.update(rubricLevels).set({ deletedAt: new Date() }).where(eq(rubricLevels.id, id));

    await logAuditEvent({
      actorId: session.user.id,
      action: 'rubric.level_deleted',
      entityType: 'rubric_level',
      entityId: id.toString(),
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'softDeleteLevelHandler',
    });
  }
}
