import { describe, it, expect } from 'vitest';
import { computeStudentRisk } from '@/lib/risk-scoring';
import type { CheckpointRiskData, StudentRiskInput } from '@/lib/risk-scoring';

const NOW = new Date('2026-07-24T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** Factory for checkpoint data with sensible defaults. */
function makeCheckpoint(overrides: Partial<CheckpointRiskData> = {}): CheckpointRiskData {
  return {
    checkpointId: 1,
    state: 'unlocked',
    dueDate: new Date(NOW.getTime() + 14 * DAY_MS),
    minConsultations: 1,
    verifiedConsultationCount: 1,
    submissionCount: 0,
    latestSubmissionDate: null,
    reviseCount: 0,
    underReviewWaitDays: null,
    ...overrides,
  };
}

/** Factory for student risk input. */
function makeInput(checkpoints: CheckpointRiskData[]): StudentRiskInput {
  return { studentId: 'student-1', now: NOW, checkpoints };
}

describe('computeStudentRisk', () => {
  // ─── Signal 1: Overdue checkpoint (High, student_inaction) ─────────────

  it('signal 1: detects overdue unlocked checkpoint as High, student_inaction', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() - 1 * DAY_MS),
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('high');
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0]).toMatchObject({
      type: 'overdue_checkpoint',
      severity: 'high',
      category: 'student_inaction',
      checkpointId: 1,
    });
    expect(result.factors[0].description).toBeTruthy();
  });

  it('signal 1: detects overdue revise checkpoint as High', () => {
    const cp = makeCheckpoint({
      state: 'revise',
      dueDate: new Date(NOW.getTime() - 1 * DAY_MS),
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('high');
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0].type).toBe('overdue_checkpoint');
  });

  it('signal 1: does not trigger when dueDate equals NOW (boundary)', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime()),
    });
    const result = computeStudentRisk(makeInput([cp]));

    const overdue = result.factors.find((f) => f.type === 'overdue_checkpoint');
    expect(overdue).toBeUndefined();
  });

  // ─── Signal 2: Approaching deadline, no submission (Medium, student_inaction) ──

  it('signal 2: detects approaching deadline with no submission as Medium', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() + 2 * DAY_MS),
      submissionCount: 0,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('medium');
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0]).toMatchObject({
      type: 'approaching_deadline_no_submission',
      severity: 'medium',
      category: 'student_inaction',
    });
  });

  it('signal 2: triggers at exactly 3 days boundary', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() + 3 * DAY_MS),
      submissionCount: 0,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'approaching_deadline_no_submission')).toBe(true);
  });

  it('signal 2: does not trigger when deadline is more than 3 days away', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() + 4 * DAY_MS),
      submissionCount: 0,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'approaching_deadline_no_submission')).toBe(false);
  });

  it('signal 2: does not trigger when submission exists', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() + 2 * DAY_MS),
      submissionCount: 1,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'approaching_deadline_no_submission')).toBe(false);
  });

  it('signal 2: does not trigger for revise state', () => {
    const cp = makeCheckpoint({
      state: 'revise',
      dueDate: new Date(NOW.getTime() + 2 * DAY_MS),
      submissionCount: 0,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'approaching_deadline_no_submission')).toBe(false);
  });

  // ─── Signal 3: Insufficient consultations, deadline approaching (Medium, student_inaction) ──

  it('signal 3: detects insufficient consultations with approaching deadline', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() + 5 * DAY_MS),
      minConsultations: 2,
      verifiedConsultationCount: 0,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('medium');
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0]).toMatchObject({
      type: 'insufficient_consultations',
      severity: 'medium',
      category: 'student_inaction',
    });
  });

  it('signal 3: triggers at exactly 7 days boundary', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() + 7 * DAY_MS),
      minConsultations: 2,
      verifiedConsultationCount: 1,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'insufficient_consultations')).toBe(true);
  });

  it('signal 3: does not trigger when deadline is more than 7 days away', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() + 8 * DAY_MS),
      minConsultations: 2,
      verifiedConsultationCount: 0,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'insufficient_consultations')).toBe(false);
  });

  it('signal 3: does not trigger when consultations are sufficient', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() + 5 * DAY_MS),
      minConsultations: 2,
      verifiedConsultationCount: 2,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'insufficient_consultations')).toBe(false);
  });

  // ─── Signal 4: Repeated revise (Medium, student_inaction) ──────────────

  it('signal 4: detects repeated revise with count >= 2', () => {
    const cp = makeCheckpoint({
      state: 'revise',
      dueDate: new Date(NOW.getTime() + 14 * DAY_MS),
      reviseCount: 2,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('medium');
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0]).toMatchObject({
      type: 'repeated_revise',
      severity: 'medium',
      category: 'student_inaction',
    });
  });

  it('signal 4: does not trigger when reviseCount is 1', () => {
    const cp = makeCheckpoint({
      state: 'revise',
      dueDate: new Date(NOW.getTime() + 14 * DAY_MS),
      reviseCount: 1,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'repeated_revise')).toBe(false);
  });

  it('signal 4: triggers with reviseCount > 2', () => {
    const cp = makeCheckpoint({
      state: 'revise',
      dueDate: new Date(NOW.getTime() + 14 * DAY_MS),
      reviseCount: 3,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'repeated_revise')).toBe(true);
  });

  // ─── Signal 5: Stalled review (Low, pending_review) ───────────────────

  it('signal 5: detects stalled review beyond 3 days as Low, pending_review', () => {
    const cp = makeCheckpoint({
      state: 'under_review',
      dueDate: new Date(NOW.getTime() + 14 * DAY_MS),
      underReviewWaitDays: 5,
      latestSubmissionDate: new Date(NOW.getTime() - 5 * DAY_MS),
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('low');
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0]).toMatchObject({
      type: 'stalled_review',
      severity: 'low',
      category: 'pending_review',
    });
  });

  it('signal 5: does not trigger at exactly 3 days boundary', () => {
    const cp = makeCheckpoint({
      state: 'under_review',
      dueDate: new Date(NOW.getTime() + 14 * DAY_MS),
      underReviewWaitDays: 3,
      latestSubmissionDate: new Date(NOW.getTime() - 3 * DAY_MS),
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'stalled_review')).toBe(false);
  });

  it('signal 5: does not trigger for non-under_review states', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() + 14 * DAY_MS),
      underReviewWaitDays: 5,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.factors.some((f) => f.type === 'stalled_review')).toBe(false);
  });

  // ─── Multi-factor aggregation ──────────────────────────────────────────

  it('aggregates multiple factors and returns highest severity', () => {
    const cp = makeCheckpoint({
      checkpointId: 1,
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() - 1 * DAY_MS), // overdue → High
      submissionCount: 0, // also triggers signal 2
      minConsultations: 2,
      verifiedConsultationCount: 0, // also triggers signal 3
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('high');
    expect(result.factors.length).toBeGreaterThanOrEqual(1);
    expect(result.factors.some((f) => f.type === 'overdue_checkpoint')).toBe(true);
  });

  it('aggregates factors across multiple checkpoints', () => {
    const cp1 = makeCheckpoint({
      checkpointId: 1,
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() - 1 * DAY_MS), // overdue → High
    });
    const cp2 = makeCheckpoint({
      checkpointId: 2,
      state: 'revise',
      dueDate: new Date(NOW.getTime() + 14 * DAY_MS),
      reviseCount: 2, // repeated revise → Medium
    });
    const result = computeStudentRisk(makeInput([cp1, cp2]));

    expect(result.level).toBe('high');
    expect(result.factors).toHaveLength(2);
    expect(
      result.factors.some((f) => f.checkpointId === 1 && f.type === 'overdue_checkpoint'),
    ).toBe(true);
    expect(result.factors.some((f) => f.checkpointId === 2 && f.type === 'repeated_revise')).toBe(
      true,
    );
  });

  // ─── No-risk student ───────────────────────────────────────────────────

  it('returns low level with empty factors for no-risk student', () => {
    const cp = makeCheckpoint({
      state: 'unlocked',
      dueDate: new Date(NOW.getTime() + 14 * DAY_MS),
      submissionCount: 1,
      minConsultations: 1,
      verifiedConsultationCount: 1,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('low');
    expect(result.factors).toHaveLength(0);
  });

  // ─── Excluded states ──────────────────────────────────────────────────

  it('excludes passed checkpoints from risk computation', () => {
    const cp = makeCheckpoint({
      state: 'passed',
      dueDate: new Date(NOW.getTime() - 1 * DAY_MS), // would be overdue
      reviseCount: 5, // would be repeated revise
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('low');
    expect(result.factors).toHaveLength(0);
  });

  it('excludes locked checkpoints from risk computation', () => {
    const cp = makeCheckpoint({
      state: 'locked',
      dueDate: new Date(NOW.getTime() - 1 * DAY_MS), // would be overdue
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('low');
    expect(result.factors).toHaveLength(0);
  });

  it('handles empty checkpoints array', () => {
    const result = computeStudentRisk(makeInput([]));

    expect(result.level).toBe('low');
    expect(result.factors).toHaveLength(0);
  });

  it('handles submitted state without triggering signals', () => {
    const cp = makeCheckpoint({
      state: 'submitted',
      dueDate: new Date(NOW.getTime() + 14 * DAY_MS),
      submissionCount: 1,
    });
    const result = computeStudentRisk(makeInput([cp]));

    expect(result.level).toBe('low');
    expect(result.factors).toHaveLength(0);
  });
});
