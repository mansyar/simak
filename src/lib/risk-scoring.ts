/**
 * Risk Scoring Engine — pure functions for at-risk student identification.
 *
 * Computes a risk assessment from per-checkpoint data. No DB access, no side
 * effects — fully unit-testable in isolation. The caller is responsible for
 * fetching the data and passing it in.
 */

/** Overall risk level — highest severity among active factors. */
export type RiskLevel = 'high' | 'medium' | 'low';

/** Immutable identifier for the risk rules used to produce an observation. */
export const RISK_ALGORITHM_VERSION = 'risk-v1';

/** Category grouping for dashboard display. */
export type RiskCategory = 'student_inaction' | 'pending_review';

/** Identifies which of the 5 risk signals was triggered. */
export type RiskSignalType =
  | 'overdue_checkpoint'
  | 'approaching_deadline_no_submission'
  | 'insufficient_consultations'
  | 'repeated_revise'
  | 'stalled_review';

/** A single risk factor detected for a checkpoint. */
export interface RiskFactor {
  type: RiskSignalType;
  severity: RiskLevel;
  category: RiskCategory;
  checkpointId: number;
  description: string;
}

/** Per-checkpoint data needed for risk computation. */
export interface CheckpointRiskData {
  checkpointId: number;
  state: 'locked' | 'unlocked' | 'submitted' | 'under_review' | 'passed' | 'revise';
  dueDate: Date;
  minConsultations: number;
  verifiedConsultationCount: number;
  submissionCount: number;
  latestSubmissionDate: Date | null;
  reviseCount: number;
  /** Days since latest submission if state is under_review; null otherwise. */
  underReviewWaitDays: number | null;
}

/** Input to computeStudentRisk — all checkpoints for one student. */
export interface StudentRiskInput {
  studentId: string;
  /** Reference time for deadline comparisons. */
  now: Date;
  checkpoints: CheckpointRiskData[];
}

/** Result of risk computation. */
export interface RiskAssessment {
  level: RiskLevel;
  factors: RiskFactor[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Severity ranking for comparison (higher = more severe). */
const SEVERITY_RANK: Record<RiskLevel, number> = { high: 3, medium: 2, low: 1 };

/**
 * Compute a student's risk assessment from checkpoint data.
 *
 * Evaluates 5 risk signals:
 * 1. Overdue checkpoint (High, student_inaction)
 * 2. Approaching deadline, no submission (Medium, student_inaction)
 * 3. Insufficient consultations, deadline approaching (Medium, student_inaction)
 * 4. Repeated revise ≥ 2 (Medium, student_inaction)
 * 5. Stalled review > 3 days (Low, pending_review)
 *
 * Overall level = highest severity among active factors.
 * Checkpoints in 'locked' or 'passed' state are excluded.
 */
export function computeStudentRisk(data: StudentRiskInput): RiskAssessment {
  const factors: RiskFactor[] = [];

  for (const cp of data.checkpoints) {
    // Skip checkpoints that are locked or passed — no risk
    if (cp.state === 'locked' || cp.state === 'passed') continue;

    const nowMs = data.now.getTime();
    const dueMs = cp.dueDate.getTime();

    // Signal 1: Overdue checkpoint (High, student_inaction)
    if ((cp.state === 'unlocked' || cp.state === 'revise') && dueMs < nowMs) {
      factors.push({
        type: 'overdue_checkpoint',
        severity: 'high',
        category: 'student_inaction',
        checkpointId: cp.checkpointId,
        description: 'Checkpoint is overdue',
      });
    }

    // Signal 2: Approaching deadline, no submission (Medium, student_inaction)
    // Only for future deadlines — overdue checkpoints are caught by signal 1
    if (
      cp.state === 'unlocked' &&
      dueMs > nowMs &&
      dueMs <= nowMs + 3 * DAY_MS &&
      cp.submissionCount === 0
    ) {
      factors.push({
        type: 'approaching_deadline_no_submission',
        severity: 'medium',
        category: 'student_inaction',
        checkpointId: cp.checkpointId,
        description: 'Deadline approaching with no submission',
      });
    }

    // Signal 3: Insufficient consultations, deadline approaching (Medium, student_inaction)
    if (cp.verifiedConsultationCount < cp.minConsultations && dueMs <= nowMs + 7 * DAY_MS) {
      factors.push({
        type: 'insufficient_consultations',
        severity: 'medium',
        category: 'student_inaction',
        checkpointId: cp.checkpointId,
        description: 'Insufficient consultations before deadline',
      });
    }

    // Signal 4: Repeated revise (Medium, student_inaction)
    if (cp.reviseCount >= 2) {
      factors.push({
        type: 'repeated_revise',
        severity: 'medium',
        category: 'student_inaction',
        checkpointId: cp.checkpointId,
        description: 'Checkpoint has been revised multiple times',
      });
    }

    // Signal 5: Stalled review beyond SLA (Low, pending_review)
    if (
      cp.state === 'under_review' &&
      cp.underReviewWaitDays !== null &&
      cp.underReviewWaitDays > 3
    ) {
      factors.push({
        type: 'stalled_review',
        severity: 'low',
        category: 'pending_review',
        checkpointId: cp.checkpointId,
        description: 'Submission awaiting review beyond SLA',
      });
    }
  }

  // Overall level = highest severity among active factors
  const level: RiskLevel = factors.reduce<RiskLevel>(
    (highest, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[highest] ? f.severity : highest),
    'low',
  );

  return { level, factors };
}
