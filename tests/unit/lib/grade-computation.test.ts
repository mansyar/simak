import { describe, it, expect } from 'vitest';
import {
  computeFinalGrade,
  type CheckpointGradeInput,
  type AssignmentGradeConfig,
} from '@/lib/grade-computation';

const defaultConfig: AssignmentGradeConfig = {
  gradingScheme: 'equal_weight',
  customWeights: null,
  letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
};

// Helper: a pass/fail checkpoint (gradingType = null)
function passFailCheckpoint(overrides: Partial<CheckpointGradeInput> = {}): CheckpointGradeInput {
  return {
    checkpointId: 1,
    checkpointName: 'Checkpoint 1',
    templateCheckpointId: 10,
    order: 1,
    state: 'passed',
    gradingType: null,
    reviewScores: [],
    ...overrides,
  };
}

// Helper: a rubric checkpoint (gradingType = 'numeric')
function rubricCheckpoint(overrides: Partial<CheckpointGradeInput> = {}): CheckpointGradeInput {
  return {
    checkpointId: 2,
    checkpointName: 'Checkpoint 2',
    templateCheckpointId: 20,
    order: 2,
    state: 'passed',
    gradingType: 'numeric',
    reviewScores: [],
    ...overrides,
  };
}

describe('computeFinalGrade', () => {
  // --- Pass/fail checkpoints (gradingType null) ---

  describe('pass/fail checkpoints (gradingType null)', () => {
    it('scores 100 when state is passed', () => {
      const result = computeFinalGrade([passFailCheckpoint({ state: 'passed' })], defaultConfig);
      expect(result.contributingCheckpoints[0].score).toBe(100);
      expect(result.contributingCheckpoints[0].isRubric).toBe(false);
    });

    it('scores 0 when state is not passed', () => {
      const result = computeFinalGrade([passFailCheckpoint({ state: 'revise' })], defaultConfig);
      expect(result.contributingCheckpoints[0].score).toBe(0);
    });

    it('scores 0 when state is locked', () => {
      const result = computeFinalGrade([passFailCheckpoint({ state: 'locked' })], defaultConfig);
      expect(result.contributingCheckpoints[0].score).toBe(0);
    });
  });

  // --- Rubric checkpoints (numeric/qualitative) ---

  describe('rubric checkpoints (numeric/qualitative)', () => {
    it('aggregates review_scores weighted by criterion weight', () => {
      const cp = rubricCheckpoint({
        reviewScores: [
          {
            criterionId: 1,
            criterionTitle: 'Criterion A',
            score: 80,
            weight: 50,
            rubricLevelId: null,
            levelLabel: null,
          },
          {
            criterionId: 2,
            criterionTitle: 'Criterion B',
            score: 90,
            weight: 50,
            rubricLevelId: null,
            levelLabel: null,
          },
        ],
      });
      const result = computeFinalGrade([cp], defaultConfig);
      // weighted: (80*50/100) + (90*50/100) = 40 + 45 = 85
      expect(result.contributingCheckpoints[0].score).toBe(85);
      expect(result.contributingCheckpoints[0].isRubric).toBe(true);
    });

    it('handles weights not summing to 100 within a checkpoint', () => {
      const cp = rubricCheckpoint({
        reviewScores: [
          {
            criterionId: 1,
            criterionTitle: 'A',
            score: 100,
            weight: 30,
            rubricLevelId: null,
            levelLabel: null,
          },
          {
            criterionId: 2,
            criterionTitle: 'B',
            score: 50,
            weight: 20,
            rubricLevelId: null,
            levelLabel: null,
          },
        ],
      });
      const result = computeFinalGrade([cp], defaultConfig);
      // total weight = 50, weighted score = (100*30 + 50*20) / 50 = (3000+1000)/50 = 80
      expect(result.contributingCheckpoints[0].score).toBe(80);
    });

    it('returns 0 score for rubric checkpoint with no review scores', () => {
      const cp = rubricCheckpoint({ reviewScores: [] });
      const result = computeFinalGrade([cp], defaultConfig);
      expect(result.contributingCheckpoints[0].score).toBe(0);
    });
  });

  // --- Equal weight scheme ---

  describe('equal_weight scheme', () => {
    it('computes simple average of checkpoint scores', () => {
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, templateCheckpointId: 10, state: 'passed' }), // 100
        passFailCheckpoint({
          checkpointId: 2,
          templateCheckpointId: 20,
          state: 'revise',
          order: 2,
        }), // 0
      ];
      const result = computeFinalGrade(checkpoints, defaultConfig);
      // (100 + 0) / 2 = 50
      expect(result.numericScore).toBe(50);
    });

    it('computes average with three checkpoints', () => {
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, templateCheckpointId: 10, state: 'passed' }), // 100
        passFailCheckpoint({
          checkpointId: 2,
          templateCheckpointId: 20,
          state: 'passed',
          order: 2,
        }), // 100
        passFailCheckpoint({
          checkpointId: 3,
          templateCheckpointId: 30,
          state: 'locked',
          order: 3,
        }), // 0
      ];
      const result = computeFinalGrade(checkpoints, defaultConfig);
      // (100 + 100 + 0) / 3 = 66.67
      expect(result.numericScore).toBeCloseTo(66.67, 1);
    });
  });

  // --- Custom weight scheme ---

  describe('custom_weight scheme', () => {
    it('computes weighted average by templateCheckpointId', () => {
      const config: AssignmentGradeConfig = {
        gradingScheme: 'custom_weight',
        customWeights: { '10': 70, '20': 30 },
        letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
      };
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, templateCheckpointId: 10, state: 'passed' }), // 100 * 0.7
        passFailCheckpoint({
          checkpointId: 2,
          templateCheckpointId: 20,
          state: 'revise',
          order: 2,
        }), // 0 * 0.3
      ];
      const result = computeFinalGrade(checkpoints, config);
      // (100 * 70 + 0 * 30) / 100 = 70
      expect(result.numericScore).toBe(70);
    });

    it('computes weighted average with mixed rubric and pass/fail', () => {
      const config: AssignmentGradeConfig = {
        gradingScheme: 'custom_weight',
        customWeights: { '10': 60, '20': 40 },
        letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
      };
      const checkpoints: CheckpointGradeInput[] = [
        passFailCheckpoint({ checkpointId: 1, templateCheckpointId: 10, state: 'passed' }), // 100 * 0.6
        rubricCheckpoint({
          checkpointId: 2,
          templateCheckpointId: 20,
          order: 2,
          reviewScores: [
            {
              criterionId: 1,
              criterionTitle: 'A',
              score: 75,
              weight: 100,
              rubricLevelId: null,
              levelLabel: null,
            },
          ],
        }), // 75 * 0.4
      ];
      const result = computeFinalGrade(checkpoints, config);
      // (100 * 60 + 75 * 40) / 100 = (6000 + 3000) / 100 = 90
      expect(result.numericScore).toBe(90);
    });
  });

  // --- Status derivation ---

  describe('status derivation', () => {
    it('returns complete when all checkpoints are passed', () => {
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, state: 'passed' }),
        passFailCheckpoint({ checkpointId: 2, state: 'passed', order: 2 }),
      ];
      const result = computeFinalGrade(checkpoints, defaultConfig);
      expect(result.status).toBe('complete');
    });

    it('returns in_progress when some checkpoints are passed', () => {
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, state: 'passed' }),
        passFailCheckpoint({ checkpointId: 2, state: 'locked', order: 2 }),
      ];
      const result = computeFinalGrade(checkpoints, defaultConfig);
      expect(result.status).toBe('in_progress');
    });

    it('returns incomplete when no checkpoints are passed', () => {
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, state: 'locked' }),
        passFailCheckpoint({ checkpointId: 2, state: 'locked', order: 2 }),
      ];
      const result = computeFinalGrade(checkpoints, defaultConfig);
      expect(result.status).toBe('incomplete');
    });
  });

  // --- Letter grade boundaries ---

  describe('letter grade boundaries', () => {
    it('returns A for score exactly 90', () => {
      const checkpoints = [passFailCheckpoint({ state: 'passed' })]; // score 100
      const config: AssignmentGradeConfig = {
        gradingScheme: 'equal_weight',
        customWeights: null,
        letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
      };
      const result = computeFinalGrade(checkpoints, config);
      // score = 100 >= 90 → A
      expect(result.letterGrade).toBe('A');
    });

    it('returns B for score below 90 but at or above 80', () => {
      const checkpoints: CheckpointGradeInput[] = [
        passFailCheckpoint({ checkpointId: 1, templateCheckpointId: 10, state: 'passed' }), // 100
        rubricCheckpoint({
          checkpointId: 2,
          templateCheckpointId: 20,
          order: 2,
          reviewScores: [
            {
              criterionId: 1,
              criterionTitle: 'A',
              score: 79,
              weight: 100,
              rubricLevelId: null,
              levelLabel: null,
            },
          ],
        }), // 79
      ];
      const result = computeFinalGrade(checkpoints, defaultConfig);
      // (100 + 79) / 2 = 89.5 → B (>= 80, < 90)
      expect(result.numericScore).toBe(89.5);
      expect(result.letterGrade).toBe('B');
    });

    it('returns F for score below D bound', () => {
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, state: 'revise' }), // 0
        passFailCheckpoint({ checkpointId: 2, state: 'locked', order: 2 }), // 0
      ];
      const result = computeFinalGrade(checkpoints, defaultConfig);
      // score = 0 < 60 → F
      expect(result.letterGrade).toBe('F');
    });

    it('returns C for score exactly 70', () => {
      const cp = rubricCheckpoint({
        reviewScores: [
          {
            criterionId: 1,
            criterionTitle: 'A',
            score: 70,
            weight: 100,
            rubricLevelId: null,
            levelLabel: null,
          },
        ],
      });
      const result = computeFinalGrade([cp], defaultConfig);
      // score = 70 >= 70 → C (70 < 80 so not B)
      expect(result.letterGrade).toBe('C');
    });

    it('returns D for score exactly 60', () => {
      const cp = rubricCheckpoint({
        reviewScores: [
          {
            criterionId: 1,
            criterionTitle: 'A',
            score: 60,
            weight: 100,
            rubricLevelId: null,
            levelLabel: null,
          },
        ],
      });
      const result = computeFinalGrade([cp], defaultConfig);
      expect(result.letterGrade).toBe('D');
    });

    it('returns F for score 59.99', () => {
      const cp = rubricCheckpoint({
        reviewScores: [
          {
            criterionId: 1,
            criterionTitle: 'A',
            score: 59,
            weight: 100,
            rubricLevelId: null,
            levelLabel: null,
          },
        ],
      });
      const result = computeFinalGrade([cp], defaultConfig);
      expect(result.letterGrade).toBe('F');
    });
  });

  // --- Stale custom weights ---

  describe('stale custom weights', () => {
    it('falls back to equal_weight when weights do not sum to 100', () => {
      const config: AssignmentGradeConfig = {
        gradingScheme: 'custom_weight',
        customWeights: { '10': 50, '20': 30 }, // sums to 80, not 100
        letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
      };
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, templateCheckpointId: 10, state: 'passed' }), // 100
        passFailCheckpoint({
          checkpointId: 2,
          templateCheckpointId: 20,
          state: 'passed',
          order: 2,
        }), // 100
      ];
      const result = computeFinalGrade(checkpoints, config);
      // Should fall back to equal_weight: (100 + 100) / 2 = 100
      expect(result.numericScore).toBe(100);
      expect(result.staleWeights).toBe(true);
    });

    it('falls back to equal_weight when missing checkpoint entries', () => {
      const config: AssignmentGradeConfig = {
        gradingScheme: 'custom_weight',
        customWeights: { '10': 100 }, // missing entry for templateCheckpointId 20
        letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
      };
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, templateCheckpointId: 10, state: 'passed' }), // 100
        passFailCheckpoint({
          checkpointId: 2,
          templateCheckpointId: 20,
          state: 'revise',
          order: 2,
        }), // 0
      ];
      const result = computeFinalGrade(checkpoints, config);
      // Falls back to equal_weight: (100 + 0) / 2 = 50
      expect(result.numericScore).toBe(50);
      expect(result.staleWeights).toBe(true);
    });

    it('does not set staleWeights when custom weights are valid', () => {
      const config: AssignmentGradeConfig = {
        gradingScheme: 'custom_weight',
        customWeights: { '10': 50, '20': 50 },
        letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
      };
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, templateCheckpointId: 10, state: 'passed' }),
        passFailCheckpoint({
          checkpointId: 2,
          templateCheckpointId: 20,
          state: 'passed',
          order: 2,
        }),
      ];
      const result = computeFinalGrade(checkpoints, config);
      expect(result.staleWeights).toBe(false);
    });
  });

  // --- Null config (uses defaults) ---

  describe('null config', () => {
    it('uses default equal_weight scheme and standard letter bounds when config is null', () => {
      const checkpoints = [
        passFailCheckpoint({ checkpointId: 1, state: 'passed' }),
        passFailCheckpoint({ checkpointId: 2, state: 'passed', order: 2 }),
      ];
      const result = computeFinalGrade(checkpoints, null);
      // equal_weight: (100 + 100) / 2 = 100, letter A
      expect(result.numericScore).toBe(100);
      expect(result.letterGrade).toBe('A');
      expect(result.status).toBe('complete');
      expect(result.staleWeights).toBe(false);
    });
  });

  // --- Empty checkpoints ---

  describe('empty checkpoints', () => {
    it('returns null score, incomplete status, F letter for empty checkpoints', () => {
      const result = computeFinalGrade([], defaultConfig);
      expect(result.numericScore).toBeNull();
      expect(result.status).toBe('incomplete');
      expect(result.letterGrade).toBeNull();
      expect(result.contributingCheckpoints).toEqual([]);
    });
  });

  // --- Contributing checkpoints output ---

  describe('contributingCheckpoints output', () => {
    it('includes all checkpoints with correct fields', () => {
      const checkpoints: CheckpointGradeInput[] = [
        passFailCheckpoint({
          checkpointId: 1,
          checkpointName: 'Intro',
          templateCheckpointId: 10,
          order: 1,
          state: 'passed',
        }),
        rubricCheckpoint({
          checkpointId: 2,
          checkpointName: 'Report',
          templateCheckpointId: 20,
          order: 2,
          state: 'passed',
          reviewScores: [
            {
              criterionId: 1,
              criterionTitle: 'Quality',
              score: 85,
              weight: 100,
              rubricLevelId: null,
              levelLabel: null,
            },
          ],
        }),
      ];
      const result = computeFinalGrade(checkpoints, defaultConfig);
      expect(result.contributingCheckpoints).toHaveLength(2);
      expect(result.contributingCheckpoints[0]).toMatchObject({
        checkpointId: 1,
        checkpointName: 'Intro',
        templateCheckpointId: 10,
        order: 1,
        state: 'passed',
        score: 100,
        isRubric: false,
      });
      expect(result.contributingCheckpoints[1]).toMatchObject({
        checkpointId: 2,
        checkpointName: 'Report',
        templateCheckpointId: 20,
        order: 2,
        state: 'passed',
        score: 85,
        isRubric: true,
      });
    });
  });
});
