/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import {
  GetAdminRiskTrendsSchema,
  GetStudentSupportStatusSchema,
  ListInstructorRiskHistorySchema,
  RiskLifecycleEventTypeSchema,
  RiskObservationSnapshotSchema,
  RiskObservationSourceSchema,
  StudentSupportStatusSchema,
  getAdminRiskTrends,
  getStudentSupportStatus,
  listInstructorRiskHistory,
} from '@/server/risk-history';

describe('risk history schemas', () => {
  it('defines the supported observation sources and lifecycle event types', () => {
    expect(RiskObservationSourceSchema.options).toEqual(['lifecycle_event', 'daily_snapshot']);
    expect(RiskLifecycleEventTypeSchema.options).toEqual([
      'checkpoint_updated',
      'submission_recorded',
      'review_recorded',
      'consultation_verified',
      'intervention_updated',
    ]);
  });

  it('accepts a complete immutable lifecycle observation snapshot', () => {
    expect(
      RiskObservationSnapshotSchema.safeParse({
        source: 'lifecycle_event',
        eventType: 'review_recorded',
        sourceEventId: 'review:42',
        idempotencyKey: 'risk-observation:review:42',
        assignmentId: 12,
        studentId: 'student-1',
        checkpointId: 8,
        interventionId: null,
        observedAt: '2026-08-10T10:00:00.000Z',
        algorithmVersion: 'risk-v1',
        riskLevel: 'high',
        factors: [
          {
            code: 'overdue_checkpoint',
            category: 'student_inaction',
            severity: 'high',
          },
        ],
        explanationSnapshot: {
          summary: 'A checkpoint is overdue.',
          inputs: { overdueCheckpoints: 1 },
        },
      }).success,
    ).toBe(true);
  });

  it('requires a lifecycle event identity and rejects unknown snapshot fields', () => {
    const result = RiskObservationSnapshotSchema.safeParse({
      source: 'lifecycle_event',
      idempotencyKey: 'risk-observation:missing-event',
      assignmentId: 12,
      studentId: 'student-1',
      observedAt: new Date(),
      algorithmVersion: 'risk-v1',
      riskLevel: 'medium',
      factors: [],
      explanationSnapshot: {},
      mutableScore: 100,
    });

    expect(result.success).toBe(false);
  });

  it('normalizes instructor history filters and bounds pagination', () => {
    expect(
      ListInstructorRiskHistorySchema.parse({ assignmentId: 12, studentId: ' student-1 ' }),
    ).toEqual({
      assignmentId: 12,
      studentId: 'student-1',
      from: null,
      to: null,
      page: 1,
      limit: 20,
    });
    expect(
      ListInstructorRiskHistorySchema.safeParse({
        assignmentId: 12,
        studentId: 'student-1',
        limit: 101,
      }).success,
    ).toBe(false);
  });

  it('normalizes aggregate scope filters and rejects an empty scope', () => {
    expect(GetAdminRiskTrendsSchema.parse({ termId: 5 })).toEqual({
      termId: 5,
      courseId: null,
      sectionId: null,
      from: null,
      to: null,
    });
    expect(GetAdminRiskTrendsSchema.safeParse({}).success).toBe(false);
  });

  it('accepts only an assignment context for student support status', () => {
    expect(GetStudentSupportStatusSchema.parse({ assignmentId: 12 })).toEqual({ assignmentId: 12 });
    expect(GetStudentSupportStatusSchema.safeParse({ assignmentId: 0 }).success).toBe(false);
  });

  it('rejects internal risk and intervention fields from the student projection', () => {
    expect(
      StudentSupportStatusSchema.safeParse({
        status: 'support_available',
        nextSteps: ['Book a consultation'],
        riskLevel: 'high',
      }).success,
    ).toBe(false);
  });

  it('exports the role-scoped read server functions', () => {
    expect(typeof listInstructorRiskHistory).toBe('function');
    expect(typeof getAdminRiskTrends).toBe('function');
    expect(typeof getStudentSupportStatus).toBe('function');
  });
});
