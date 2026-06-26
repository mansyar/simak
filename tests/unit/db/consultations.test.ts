import { describe, it, expect } from 'vitest';

describe('Consultations schema', () => {
  it('should export consultations table', async () => {
    const mod = await import('@/db/schema/consultations');
    expect(mod).toHaveProperty('consultations');
  });

  it('should have correct columns on consultations', async () => {
    const { consultations } = await import('@/db/schema/consultations');
    expect(consultations).toHaveProperty('id');
    expect(consultations).toHaveProperty('assignmentId');
    expect(consultations).toHaveProperty('checkpointId');
    expect(consultations).toHaveProperty('studentId');
    expect(consultations).toHaveProperty('verifiedById');
    expect(consultations).toHaveProperty('status');
    expect(consultations).toHaveProperty('notes');
    expect(consultations).toHaveProperty('externalConsultantName');
    expect(consultations).toHaveProperty('sessionType');
    expect(consultations).toHaveProperty('verifiedAt');
    expect(consultations).toHaveProperty('createdAt');
  });
});

describe('Notifications schema', () => {
  it('should export notifications table', async () => {
    const mod = await import('@/db/schema/notifications');
    expect(mod).toHaveProperty('notifications');
  });

  it('should have correct columns on notifications', async () => {
    const { notifications } = await import('@/db/schema/notifications');
    expect(notifications).toHaveProperty('id');
    expect(notifications).toHaveProperty('userId');
    expect(notifications).toHaveProperty('type');
    expect(notifications).toHaveProperty('titleKey');
    expect(notifications).toHaveProperty('messageKey');
    expect(notifications).toHaveProperty('params');
    expect(notifications).toHaveProperty('read');
    expect(notifications).toHaveProperty('channel');
    expect(notifications).toHaveProperty('metadata');
    expect(notifications).toHaveProperty('createdAt');
  });
});
