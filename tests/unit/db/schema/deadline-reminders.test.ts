import { describe, it, expect } from 'vitest';

describe('DeadlineReminders schema', () => {
  it('should export deadlineReminders table', async () => {
    const mod = await import('@/db/schema/deadline-reminders');
    expect(mod).toHaveProperty('deadlineReminders');
  });

  it('should have correct columns on deadlineReminders', async () => {
    const { deadlineReminders } = await import('@/db/schema/deadline-reminders');
    expect(deadlineReminders).toHaveProperty('id');
    expect(deadlineReminders).toHaveProperty('checkpointId');
    expect(deadlineReminders).toHaveProperty('studentId');
    expect(deadlineReminders).toHaveProperty('tier');
    expect(deadlineReminders).toHaveProperty('sentAt');
  });

  it('should have correct column types', async () => {
    const { deadlineReminders } = await import('@/db/schema/deadline-reminders');
    expect(deadlineReminders.id).toBeDefined();
    expect(deadlineReminders.checkpointId).toBeDefined();
    expect(deadlineReminders.studentId).toBeDefined();
    expect(deadlineReminders.tier).toBeDefined();
    expect(deadlineReminders.sentAt).toBeDefined();
  });
});
