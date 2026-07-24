// Server-only helper for validating and persisting rubric review scores.
// Validation (validateReviewScores) must be called BEFORE any write in the
// review transaction; insertion (insertReviewScores) is called AFTER the
// review row is inserted with .returning() to capture the review ID.
import { reviewScores } from '../db/schema/rubrics';
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

type ScoreRow = {
  reviewId: number;
  criterionId: number;
  criterionTitle: string;
  score: number;
  weight: number;
  rubricLevelId: number | null;
  levelLabel: string | null;
  comment: string | null;
};

/**
 * Validate rubric scores against the live rubric state.
 * Must be called BEFORE any write in the review transaction (SQL styleguide §6):
 * a validation failure returns a ServerError and the caller must return BEFORE
 * inserting the review row, so the transaction commits as a no-op.
 * Returns ServerError on validation failure, null on success.
 */
export async function validateReviewScores(
  tx: Db,
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

  // Reject duplicate criterion scores (prevents inflated analytics counts)
  const criterionIds = scores.map((s) => s.criterionId);
  if (new Set(criterionIds).size !== criterionIds.length) {
    return serverError(ErrorCode.BAD_REQUEST, 'Duplicate criterion scores provided');
  }

  // All current criteria must be scored (re-validates against live rubric state)
  for (const criterion of rubric.criteria) {
    if (!scores.some((s) => s.criterionId === criterion.id)) {
      return serverError(ErrorCode.BAD_REQUEST, `Criterion "${criterion.title}" not scored`);
    }
  }

  // Validate rubricLevelId belongs to this rubric (FK only checks global existence)
  const levelIds = new Set(rubric.levels.map((l) => l.id));
  for (const s of scores) {
    if (s.rubricLevelId && !levelIds.has(s.rubricLevelId)) {
      return serverError(ErrorCode.BAD_REQUEST, 'Invalid rubric level for this checkpoint');
    }
  }

  return null;
}

/**
 * Insert denormalized snapshot rows for rubric scores.
 * Called AFTER the review row is inserted (reviewId captured via .returning()).
 * Assumes validation already passed (call validateReviewScores first).
 * Re-fetches the rubric inside the transaction to build snapshot fields.
 */
export async function insertReviewScores(
  tx: Db,
  reviewId: number,
  templateCheckpointId: number,
  scores: ScoreInput[],
): Promise<void> {
  const rubric = await fetchRubric(tx, templateCheckpointId);
  if (!rubric || rubric.gradingType === null) return;

  const levelMap = new Map(rubric.levels.map((l) => [l.id, l.label]));
  const criterionMap = new Map(rubric.criteria.map((c) => [c.id, c]));

  const rows: ScoreRow[] = [];
  for (const s of scores) {
    const c = criterionMap.get(s.criterionId);
    if (!c) continue; // score for removed criterion — skip
    rows.push({
      reviewId,
      criterionId: s.criterionId,
      criterionTitle: c.title,
      score: s.score,
      weight: c.weight,
      rubricLevelId: s.rubricLevelId ?? null,
      levelLabel: s.rubricLevelId ? (levelMap.get(s.rubricLevelId) ?? null) : null,
      comment: s.comment ?? null,
    });
  }

  if (rows.length > 0) {
    await tx.insert(reviewScores).values(rows);
  }
}
