/**
 * Grade Computation Engine — pure functions, no DB access.
 *
 * Aggregates rubric-based review scores and pass/fail checkpoint states
 * into weighted final grades with configurable letter grade mapping.
 */

// ---- Types ----

export type GradingScheme = 'equal_weight' | 'custom_weight';

export type CheckpointState =
  | 'locked'
  | 'unlocked'
  | 'submitted'
  | 'under_review'
  | 'passed'
  | 'revise';

export interface ReviewScoreInput {
  criterionId: number;
  criterionTitle: string;
  score: number;
  weight: number;
  rubricLevelId: number | null;
  levelLabel: string | null;
}

export interface CheckpointGradeInput {
  checkpointId: number;
  checkpointName: string;
  templateCheckpointId: number | null;
  order: number;
  state: CheckpointState;
  /** null = pass/fail; 'numeric' | 'qualitative' = rubric-graded */
  gradingType: 'numeric' | 'qualitative' | null;
  /** Denormalized review_scores snapshot (only for rubric checkpoints) */
  reviewScores: ReviewScoreInput[];
}

export interface AssignmentGradeConfig {
  gradingScheme: GradingScheme;
  /** { [templateCheckpointId]: weight } map, values 0–100 */
  customWeights: Record<string, number> | null;
  /** { "A": 90, "B": 80, "C": 70, "D": 60 } */
  letterGradeBounds: Record<string, number>;
}

export interface ContributingCheckpoint {
  checkpointId: number;
  checkpointName: string;
  templateCheckpointId: number | null;
  order: number;
  state: CheckpointState;
  score: number;
  isRubric: boolean;
  weight: number;
}

export interface FinalGradeResult {
  numericScore: number | null;
  letterGrade: string | null;
  status: 'complete' | 'incomplete' | 'in_progress';
  contributingCheckpoints: ContributingCheckpoint[];
  /** True if custom weights were invalid and computation fell back to equal_weight */
  staleWeights: boolean;
}

// ---- Constants ----

const DEFAULT_LETTER_BOUNDS: Record<string, number> = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
};

// ---- Pure Functions ----

/**
 * Compute the score for a single checkpoint.
 * - Pass/fail (gradingType null): 100 if passed, 0 otherwise.
 * - Rubric (numeric/qualitative): weighted average of review_scores by criterion weight.
 */
function computeCheckpointScore(cp: CheckpointGradeInput): number {
  if (cp.gradingType === null) {
    return cp.state === 'passed' ? 100 : 0;
  }

  // Rubric checkpoint — aggregate review_scores weighted by criterion weight
  if (!cp.reviewScores || cp.reviewScores.length === 0) {
    return 0;
  }

  const totalWeight = cp.reviewScores.reduce((sum, rs) => sum + rs.weight, 0);
  if (totalWeight === 0) {
    return 0;
  }

  const weightedSum = cp.reviewScores.reduce((sum, rs) => sum + rs.score * rs.weight, 0);

  return weightedSum / totalWeight;
}

/**
 * Derive letter grade from numeric score and bounds.
 * Bounds are sorted descending; first matching bound wins.
 * Below the lowest bound → "F".
 */
function deriveLetterGrade(score: number, bounds: Record<string, number>): string {
  const sorted = Object.entries(bounds).sort(([, a], [, b]) => b - a);
  for (const [letter, bound] of sorted) {
    if (score >= bound) return letter;
  }
  return 'F';
}

/**
 * Derive completion status from checkpoints.
 * - complete: all checkpoints passed
 * - in_progress: some (but not all) checkpoints passed
 * - incomplete: no checkpoints passed
 */
function deriveStatus(
  checkpoints: CheckpointGradeInput[],
): 'complete' | 'incomplete' | 'in_progress' {
  if (checkpoints.length === 0) {
    return 'incomplete';
  }
  const passedCount = checkpoints.filter((cp) => cp.state === 'passed').length;
  if (passedCount === checkpoints.length) return 'complete';
  if (passedCount > 0) return 'in_progress';
  return 'incomplete';
}

/**
 * Check if custom weights are valid:
 * 1. customWeights is not null
 * 2. All checkpoints have an entry (keyed by templateCheckpointId as string)
 * 3. Weights sum to exactly 100
 */
function areCustomWeightsValid(
  checkpoints: CheckpointGradeInput[],
  customWeights: Record<string, number> | null,
): customWeights is Record<string, number> {
  if (!customWeights) return false;

  // No extra entries for removed checkpoints
  if (Object.keys(customWeights).length !== checkpoints.length) return false;

  // Every checkpoint must have a weight entry
  for (const cp of checkpoints) {
    if (cp.templateCheckpointId === null) return false;
    const key = String(cp.templateCheckpointId);
    if (!(key in customWeights)) return false;
  }

  // Weights must sum to 100
  const sum = Object.values(customWeights).reduce((a, b) => a + b, 0);
  if (sum !== 100) return false;

  return true;
}

/**
 * Compute the final grade for a student's assignment.
 *
 * @param checkpoints - The student's checkpoints with review score snapshots
 * @param config - The assignment's grade configuration (or null for defaults)
 * @returns FinalGradeResult with numeric score, letter grade, status, and per-checkpoint breakdown
 */
export function computeFinalGrade(
  checkpoints: CheckpointGradeInput[],
  config: AssignmentGradeConfig | null,
): FinalGradeResult {
  const scheme = config?.gradingScheme ?? 'equal_weight';
  const customWeights = config?.customWeights ?? null;
  const letterBounds = config?.letterGradeBounds ?? DEFAULT_LETTER_BOUNDS;

  // Compute per-checkpoint scores
  const contributingCheckpoints: ContributingCheckpoint[] = checkpoints.map((cp) => {
    const score = computeCheckpointScore(cp);
    const isRubric = cp.gradingType !== null;
    const weight =
      customWeights && cp.templateCheckpointId !== null
        ? (customWeights[String(cp.templateCheckpointId)] ?? 0)
        : 0;
    return {
      checkpointId: cp.checkpointId,
      checkpointName: cp.checkpointName,
      templateCheckpointId: cp.templateCheckpointId,
      order: cp.order,
      state: cp.state,
      score,
      isRubric,
      weight,
    };
  });

  // Handle empty checkpoints
  if (checkpoints.length === 0) {
    return {
      numericScore: null,
      letterGrade: null,
      status: 'incomplete',
      contributingCheckpoints: [],
      staleWeights: false,
    };
  }

  // Determine if custom weights are valid
  const useCustomWeights =
    scheme === 'custom_weight' && areCustomWeightsValid(checkpoints, customWeights);
  const staleWeights = scheme === 'custom_weight' && !useCustomWeights;

  // Compute overall score
  let numericScore: number;
  if (useCustomWeights && customWeights) {
    // Weighted average using custom weights
    let weightedSum = 0;
    for (let i = 0; i < checkpoints.length; i++) {
      const key = String(checkpoints[i].templateCheckpointId);
      const weight = customWeights[key];
      weightedSum += contributingCheckpoints[i].score * weight;
    }
    numericScore = weightedSum / 100;
  } else {
    // Equal weight — simple average
    const sum = contributingCheckpoints.reduce((s, cp) => s + cp.score, 0);
    numericScore = sum / checkpoints.length;
  }

  // Round to 2 decimal places
  numericScore = Math.round(numericScore * 100) / 100;

  const letterGrade = deriveLetterGrade(numericScore, letterBounds);
  const status = deriveStatus(checkpoints);

  return {
    numericScore,
    letterGrade,
    status,
    contributingCheckpoints,
    staleWeights,
  };
}
