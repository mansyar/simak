/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

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
  CreateInterventionSchema,
  GetInterventionContextSchema,
  InterventionActionTypeSchema,
  InterventionStatusSchema,
  ListInterventionsSchema,
  UpdateInterventionSchema,
  createIntervention,
  getInterventionContext,
  listInterventions,
  updateIntervention,
} from '@/server/interventions';

describe('Intervention schemas', () => {
  it('accepts the supported action types', () => {
    expect(InterventionActionTypeSchema.options).toEqual([
      'consultation',
      'extension',
      'discussion',
      'other',
    ]);
  });

  it('accepts the supported statuses', () => {
    expect(InterventionStatusSchema.options).toEqual([
      'open',
      'monitoring',
      'resolved',
      'dismissed',
    ]);
  });

  it('accepts a valid intervention creation request', () => {
    const result = CreateInterventionSchema.safeParse({
      assignmentId: 12,
      studentId: 'student-1',
      actionType: 'consultation',
      privateNote: 'Discussed the missing checkpoint submission.',
      followUpDate: '2026-08-15T09:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unsupported action type', () => {
    const result = CreateInterventionSchema.safeParse({
      assignmentId: 12,
      studentId: 'student-1',
      actionType: 'email',
    });

    expect(result.success).toBe(false);
  });

  it('defaults list pagination and overdue filtering', () => {
    const result = ListInterventionsSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.overdue).toBe(false);
    }
  });

  it('accepts assignment and student context lookup input', () => {
    const result = GetInterventionContextSchema.safeParse({
      assignmentId: 12,
      studentId: 'student-1',
    });

    expect(result.success).toBe(true);
  });

  it('requires a reason when resolving or dismissing an intervention', () => {
    const result = UpdateInterventionSchema.safeParse({
      interventionId: 7,
      status: 'resolved',
    });

    expect(result.success).toBe(false);
  });

  it('accepts a closure reason for a terminal status', () => {
    const result = UpdateInterventionSchema.safeParse({
      interventionId: 7,
      status: 'dismissed',
      resolutionReason: 'The student resumed the assignment independently.',
    });

    expect(result.success).toBe(true);
  });

  it('exports all instructor intervention server functions', () => {
    expect(typeof createIntervention).toBe('function');
    expect(typeof listInterventions).toBe('function');
    expect(typeof getInterventionContext).toBe('function');
    expect(typeof updateIntervention).toBe('function');
  });
});
