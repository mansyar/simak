/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  interventionActionType,
  interventionStatus,
  interventions,
} from '@/db/schema/interventions';

describe('Interventions schema', () => {
  it('defines the action type enum', () => {
    expect(interventionActionType.enumValues).toEqual([
      'consultation',
      'extension',
      'discussion',
      'other',
    ]);
  });

  it('defines the status enum', () => {
    expect(interventionStatus.enumValues).toEqual(['open', 'monitoring', 'resolved', 'dismissed']);
  });

  it('defines the assignment, student, action, status, and follow-up columns', () => {
    expect(interventions.assignmentId).toBeDefined();
    expect(interventions.studentId).toBeDefined();
    expect(interventions.actionType).toBeDefined();
    expect(interventions.status).toBeDefined();
    expect(interventions.followUpDate).toBeDefined();
    expect(interventions.resolutionReason).toBeDefined();
  });
});
