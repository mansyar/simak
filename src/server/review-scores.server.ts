// Server-only helper for validating and persisting rubric review scores.
// Must be called inside the submit review transaction.
import { eq, desc } from 'drizzle-orm';
import { reviewScores } from '../db/schema/rubrics';
import { reviews } from '../db/schema/submissions';
import { fetchRubric } from './rubrics.server';
import { getDb } from '../db/index';
import { serverError, ErrorCode, type ServerError } from '../lib/errors';

type ScoreInput = {
  criterionId: number;
  score: number;
  rubricLevelId?: number;
  comment?: string;
};

type Db = ReturnType<typeof getDb>;

/**
 * Validate and persist rubric scores for a review.
 * Returns ServerError on validation failure, null on success.
 * - No rubric (null gradingType): scores must be absent
 * - Rubric exists: all current criteria must be scored (re-validates against live rubric)
 * - Snapshot fields (criterionTitle, weight, levelLabel) are denormalized at insert time
 */
export async function persistReviewScores(
  tx: Db,
  submissionId: number,
  templateCheckpointId: number | null,
  scores: ScoreInput[] | undefined,
): Promise<ServerError | null> {
  if (!templateCheckpointId) {
    if (scores && scores.length > 0) {
      return serverError(ErrorCode.BAD_REQUEST, 'Scores provided but checkpoint has no rubric');
    }
    return null;
  }

  const rubric = await fetchRubric(tx, templateCheckpointId);

  if (!rubric || rubric.gradingType === null) {
    if (scores && scores.length > 0) {
      return serverError(ErrorCode.BAD_REQUEST, 'Scores provided but checkpoint has no rubric');
    }
    return null;
  }

  if (!scores || scores.length === 0) {
    return serverError(ErrorCode.BAD_REQUEST, 'Scores required for rubric-based checkpoint');
  }

  // All current criteria must be scored (re-validates against live rubric state)
  for (const criterion of rubric.criteria) {
    if (!scores.some((s) => s.criterionId === criterion.id)) {
      return serverError(ErrorCode.BAD_REQUEST, `Criterion "${criterion.title}" not scored`);
    }
  }

  // Build denormalized snapshot rows — filter out scores for removed criteria
  const levelMap = new Map(rubric.levels.map((l) => [l.id, l.label]));
  const criterionMap = new Map(rubric.criteria.map((c) => [c.id, c]));

  const rows = scores
    .filter((s) => criterionMap.has(s.criterionId))
    .map((s) => {
      const c = criterionMap.get(s.criterionId)!;
      return {
        criterionId: s.criterionId,
        criterionTitle: c.title,
        score: s.score,
        weight: c.weight,
        rubricLevelId: s.rubricLevelId ?? null,
        levelLabel: s.rubricLevelId ? (levelMap.get(s.rubricLevelId) ?? null) : null,
        comment: s.comment ?? null,
      };
    });

  if (rows.length > 0) {
    const [review] = await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.submissionId, submissionId))
      .orderBy(desc(reviews.id))
      .limit(1);

    if (!review) {
      return serverError(ErrorCode.INTERNAL, 'Failed to retrieve review ID');
    }

    await tx.insert(reviewScores).values(rows.map((r) => ({ ...r, reviewId: review.id })));
  }

  return null;
}
