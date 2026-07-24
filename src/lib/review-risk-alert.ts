import type { Db } from '../db/index';
import type { SLASubmissionFields } from './review-sla';
import { checkAndFireRiskAlert } from './risk-alerts';

/**
 * Post-commit advisory: fire risk alert when decision is 'revise' or SLA breach occurred.
 * Wrapped in try/catch to maintain advisory isolation — never fails the request.
 */
export async function maybeFireReviewRiskAlert(
  db: Db,
  decision: 'pass' | 'revise',
  breachDays: number,
  slaFields: SLASubmissionFields,
  instructorId: string,
): Promise<void> {
  if (decision !== 'revise' && breachDays <= 0) return;
  try {
    await checkAndFireRiskAlert(db, {
      studentId: slaFields.studentId,
      studentName: slaFields.studentName,
      assignmentId: slaFields.assignmentId,
      assignmentTitle: slaFields.assignmentTitle,
      instructorId,
    });
  } catch (advisoryErr) {
    console.error('Post-commit advisory work failed in submitReviewHandler:', advisoryErr);
  }
}
