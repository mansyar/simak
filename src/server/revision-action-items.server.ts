import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { revisionActionItems } from '@/db/schema/revision-action-items';
import { rubricCriteria } from '@/db/schema/rubrics';
import { assignments, checkpoints } from '@/db/schema/assignments';
import { reviews, submissions } from '@/db/schema/submissions';
import { getDb } from '@/db/index';
import { safeAuditLog } from '@/lib/audit';
import { isServerError, serverError, ErrorCode, type ServerError } from '@/lib/errors';
import { isStudent } from '@/lib/session-guards';
import { getSessionFromHeaders } from './auth';
import type {
  RevisionActionItemInput,
  UpdateRevisionActionItemInput,
} from './revision-action-items';

type Db = ReturnType<typeof getDb>;

type ActionItemInsertRow = {
  reviewId: number;
  itemText: string;
  order: number;
  criterionId: number | null;
  criterionTitle: string | null;
};

function validateItemInput(actionItems: RevisionActionItemInput[]): ServerError | null {
  if (actionItems.length > 10) {
    return serverError(
      ErrorCode.BAD_REQUEST,
      'A revision plan may contain at most 10 action items',
    );
  }

  for (const item of actionItems) {
    const text = item.itemText.trim();
    if (!text || text.length > 500 || /[<>]/.test(text)) {
      return serverError(
        ErrorCode.BAD_REQUEST,
        'Action items must be non-empty plain text of 500 characters or fewer',
      );
    }
  }

  return null;
}

async function buildActionItemRows(
  tx: Db,
  reviewId: number,
  templateCheckpointId: number | null,
  actionItems: RevisionActionItemInput[],
): Promise<ServerError | ActionItemInsertRow[]> {
  const inputError = validateItemInput(actionItems);
  if (inputError) return inputError;

  const criterionIds = [
    ...new Set(
      actionItems
        .map((item) => item.criterionId)
        .filter((criterionId): criterionId is number => criterionId !== undefined),
    ),
  ];

  if (criterionIds.length > 0 && !templateCheckpointId) {
    return serverError(
      ErrorCode.BAD_REQUEST,
      'Action-item criteria require a rubric on the reviewed checkpoint',
    );
  }

  const criteria =
    templateCheckpointId && criterionIds.length > 0
      ? await tx
          .select({
            id: rubricCriteria.id,
            title: rubricCriteria.title,
            templateCheckpointId: rubricCriteria.templateCheckpointId,
          })
          .from(rubricCriteria)
          .where(
            and(
              inArray(rubricCriteria.id, criterionIds),
              eq(rubricCriteria.templateCheckpointId, templateCheckpointId),
              isNull(rubricCriteria.deletedAt),
            ),
          )
      : [];

  const criterionMap = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  if (criteria.some((criterion) => criterion.templateCheckpointId !== templateCheckpointId)) {
    return serverError(ErrorCode.BAD_REQUEST, 'Action-item criterion is not part of this rubric');
  }

  for (const criterionId of criterionIds) {
    if (!criterionMap.has(criterionId)) {
      return serverError(ErrorCode.BAD_REQUEST, 'Action-item criterion is not part of this rubric');
    }
  }

  return actionItems.map((item, order) => {
    const criterion = item.criterionId ? criterionMap.get(item.criterionId) : undefined;
    return {
      reviewId,
      itemText: item.itemText.trim(),
      order,
      criterionId: item.criterionId ?? null,
      criterionTitle: criterion?.title ?? null,
    };
  });
}

export async function validateRevisionActionItems(
  tx: Db,
  templateCheckpointId: number | null,
  actionItems: RevisionActionItemInput[] | undefined,
): Promise<ServerError | null> {
  if (!actionItems || actionItems.length === 0) return null;

  const result = await buildActionItemRows(tx, 0, templateCheckpointId, actionItems);
  return isServerError(result) ? result : null;
}

export async function insertRevisionActionItems(
  tx: Db,
  args: {
    reviewId: number;
    templateCheckpointId: number | null;
    actionItems: RevisionActionItemInput[];
  },
): Promise<{ inserted: number } | ServerError> {
  if (args.actionItems.length === 0) return { inserted: 0 };

  const rows = await buildActionItemRows(
    tx,
    args.reviewId,
    args.templateCheckpointId,
    args.actionItems,
  );
  if (isServerError(rows)) return rows;

  await tx.insert(revisionActionItems).values(rows);
  return { inserted: rows.length };
}

export async function updateRevisionActionItemHandler({
  data,
}: {
  data: UpdateRevisionActionItemInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const db = getDb();

  try {
    const result = await db.transaction(async (tx) => {
      const [item] = await tx
        .select({
          id: revisionActionItems.id,
          reviewId: revisionActionItems.reviewId,
          checkpointId: checkpoints.id,
          studentId: checkpoints.studentId,
          decision: reviews.decision,
          checkpointState: checkpoints.state,
          itemText: revisionActionItems.itemText,
          addressedAt: revisionActionItems.addressedAt,
          isCurrentPlan: sql<boolean>`
            ${checkpoints.state} = 'revise'
            AND ${reviews.decision} = 'revise'
            AND NOT EXISTS (
              SELECT 1
              FROM ${reviews} AS newer_review
              INNER JOIN ${submissions} AS newer_submission
                ON newer_review.submission_id = newer_submission.id
              WHERE newer_submission.checkpoint_id = ${checkpoints.id}
                AND newer_review.decision = 'revise'
                AND EXISTS (
                  SELECT 1
                  FROM ${revisionActionItems} AS newer_action_item
                  WHERE newer_action_item.review_id = newer_review.id
                )
                AND (
                  newer_review.created_at > ${reviews.createdAt}
                  OR (
                    newer_review.created_at = ${reviews.createdAt}
                    AND newer_review.id > ${reviews.id}
                  )
                )
            )`,
        })
        .from(revisionActionItems)
        .innerJoin(reviews, eq(revisionActionItems.reviewId, reviews.id))
        .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
        .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
        .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
        .where(
          and(
            eq(revisionActionItems.id, data.itemId),
            eq(checkpoints.studentId, session.user.id),
            isNull(assignments.deletedAt),
          ),
        )
        .limit(1)
        .for('update', { of: checkpoints });

      if (
        !item ||
        item.studentId !== session.user.id ||
        item.decision !== 'revise' ||
        item.checkpointState !== 'revise' ||
        !item.isCurrentPlan
      ) {
        return null;
      }

      await tx
        .update(revisionActionItems)
        .set({ addressedAt: data.addressed ? new Date() : null, updatedAt: new Date() })
        .where(
          and(
            eq(revisionActionItems.id, data.itemId),
            eq(revisionActionItems.reviewId, item.reviewId),
          ),
        );

      return {
        itemId: data.itemId,
        reviewId: item.reviewId,
        addressed: data.addressed,
      };
    });

    if (!result) {
      return serverError(ErrorCode.NOT_FOUND, 'Current revision action item not found');
    }

    await safeAuditLog('revision-action-item-status-changed', {
      actorId: session.user.id,
      action: data.addressed
        ? 'revision_action_item.addressed'
        : 'revision_action_item.unaddressed',
      entityType: 'revision_action_item',
      entityId: String(result.itemId),
      details: result,
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'updateRevisionActionItemHandler',
      userId: session.user.id,
    });
  }
}
