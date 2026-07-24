import { describe, it, expect } from 'vitest';
import { getNotificationRoute } from '@/components/notifications/notification-routes';

describe('getNotificationRoute', () => {
  it('derives review_completed route from type + metadata', () => {
    const route = getNotificationRoute('review_completed', {
      assignmentId: 5,
      checkpointId: 10,
    });
    expect(route).toBe('/student/assignments/5/checkpoints/10');
  });

  it('derives revision_requested route from type + metadata', () => {
    const route = getNotificationRoute('revision_requested', {
      assignmentId: 5,
      checkpointId: 10,
    });
    expect(route).toBe('/student/assignments/5/checkpoints/10');
  });

  it('derives submission_received route from type + metadata', () => {
    const route = getNotificationRoute('submission_received', {
      submissionId: 42,
    });
    expect(route).toBe('/instructor/reviews/42');
  });

  it('derives consultation_verified route from type + metadata', () => {
    const route = getNotificationRoute('consultation_verified', {
      assignmentId: 7,
    });
    expect(route).toBe('/student/assignments/7');
  });

  it('derives consultation_rejected route from type + metadata', () => {
    const route = getNotificationRoute('consultation_rejected', {
      assignmentId: 7,
    });
    expect(route).toBe('/student/assignments/7');
  });

  it('derives extension_requested route from type + metadata', () => {
    const route = getNotificationRoute('extension_requested', {
      assignmentId: 3,
    });
    expect(route).toBe('/instructor/assignments/3');
  });

  it('derives extension_approved route from type + metadata', () => {
    const route = getNotificationRoute('extension_approved', {
      assignmentId: 3,
    });
    expect(route).toBe('/student/assignments/3');
  });

  it('derives extension_rejected route from type + metadata', () => {
    const route = getNotificationRoute('extension_rejected', {
      assignmentId: 3,
    });
    expect(route).toBe('/student/assignments/3');
  });

  it('derives sla_breach route to admin dashboard', () => {
    const route = getNotificationRoute('sla_breach', {
      assignmentId: 1,
    });
    expect(route).toBe('/admin/dashboard');
  });

  it('derives deadline_reminder route from type + metadata', () => {
    const route = getNotificationRoute('deadline_reminder', {
      assignmentId: 5,
      checkpointId: 12,
    });
    expect(route).toBe('/student/assignments/5/checkpoints/12');
  });

  it('returns null for deadline_reminder when assignmentId is missing', () => {
    const route = getNotificationRoute('deadline_reminder', {
      checkpointId: 12,
    });
    expect(route).toBeNull();
  });

  it('returns null for deadline_reminder when checkpointId is missing', () => {
    const route = getNotificationRoute('deadline_reminder', {
      assignmentId: 5,
    });
    expect(route).toBeNull();
  });

  it('returns null when metadata is missing', () => {
    const route = getNotificationRoute('review_completed', null);
    expect(route).toBeNull();
  });

  it('returns null when metadata is undefined', () => {
    const route = getNotificationRoute('review_completed', undefined);
    expect(route).toBeNull();
  });

  it('returns null when required metadata fields are missing', () => {
    // review_completed needs assignmentId + checkpointId
    const route = getNotificationRoute('review_completed', { assignmentId: 5 });
    expect(route).toBeNull();
  });

  it('returns null for unknown notification type', () => {
    const route = getNotificationRoute('unknown_type', { assignmentId: 1 });
    expect(route).toBeNull();
  });

  it('returns null for consultation_logged (instructor-only, no direct navigation)', () => {
    const route = getNotificationRoute('consultation_logged', { assignmentId: 1 });
    expect(route).toBeNull();
  });
});
