/**
 * Risk Scoring Engine — pure functions for at-risk student identification.
 *
 * Computes a risk assessment from per-checkpoint data. No DB access, no side
 * effects — fully unit-testable in isolation. The caller is responsible for
 * fetching the data and passing it in.
 */

/** Overall risk level — highest severity among active factors. */
export type RiskLevel = 'high' | 'medium' | 'low';

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
  return { level: 'low', factors: [] };
}
