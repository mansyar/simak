/**
 * At-risk student alert dispatch.
 *
 * Fetches student checkpoint data, computes risk, checks 7-day dedup,
 * and fires in-app notification + email to the instructor.
 * Advisory only — never throws.
 */
import type { Db } from '../db/index';

export interface RiskAlertOpts {
  studentId: string;
  studentName: string;
  assignmentId: number;
  assignmentTitle: string;
  instructorId: string;
}

export async function checkAndFireRiskAlert(_db: Db, _opts: RiskAlertOpts): Promise<void> {
  // Stub — implementation in Task 5
}
