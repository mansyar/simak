/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adjustDeadlinesForBreach, dispatchSLABreachNotifications } from '@/lib/review-sla';

vi.mock('@/lib/email', () => ({
  sendSLAAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('adjustDeadlinesForBreach', () => {
  let mockTx: any;
  const baseSubmission = {
    checkpointId: 100,
    checkpointDueDate: new Date('2026-06-01T00:00:00Z'),
    checkpointName: 'Checkpoint 1',
    checkpointOrder: 1,
    assignmentId: 10,
    assignmentTitle: 'Assignment 1',
    studentId: 'student-1',
    studentName: 'Student One',
    finalDeadline: new Date('2026-07-01T00:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };
  });

  it('should extend affected checkpoint dueDate by breach days', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await adjustDeadlinesForBreach(mockTx, baseSubmission, 3);

    expect(mockTx.update).toHaveBeenCalledTimes(2); // checkpoint + assignment
    // First update call is for the affected checkpoint
    const setCall = mockTx.set.mock.calls[0][0];
    expect(setCall.dueDate).toBeInstanceOf(Date);
    // 3 days after June 1 = June 4
    expect(setCall.dueDate.getTime()).toBe(new Date('2026-06-04T00:00:00Z').getTime());
    expect(setCall.updatedAt).toBeInstanceOf(Date);
  });

  it('should extend subsequent checkpoint dueDates', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve([
        { id: 101, dueDate: new Date('2026-06-10T00:00:00Z') },
        { id: 102, dueDate: new Date('2026-06-20T00:00:00Z') },
      ]).then(onfulfilled),
    );

    await adjustDeadlinesForBreach(mockTx, baseSubmission, 2);

    // Should have updated checkpoint + 2 subsequent + assignment = 4 updates
    expect(mockTx.update).toHaveBeenCalledTimes(4);
    // Second update = first subsequent checkpoint (id 101)
    expect(mockTx.set.mock.calls[1][0].dueDate.getTime()).toBe(
      new Date('2026-06-12T00:00:00Z').getTime(),
    );
    // Third update = second subsequent checkpoint (id 102)
    expect(mockTx.set.mock.calls[2][0].dueDate.getTime()).toBe(
      new Date('2026-06-22T00:00:00Z').getTime(),
    );
  });

  it('should query subsequent checkpoints with correct filters', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await adjustDeadlinesForBreach(mockTx, baseSubmission, 1);

    // Select is called once (for subsequent checkpoints query)
    expect(mockTx.select).toHaveBeenCalledTimes(1);
    expect(mockTx.where).toHaveBeenCalled();
  });

  it('should extend assignment finalDeadline when present', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await adjustDeadlinesForBreach(mockTx, baseSubmission, 3);

    // Last update call should be for assignment
    const lastSetCall = mockTx.set.mock.calls[1][0];
    expect(lastSetCall.finalDeadline).toBeInstanceOf(Date);
    expect(lastSetCall.finalDeadline.getTime()).toBe(new Date('2026-07-04T00:00:00Z').getTime());
  });

  it('should NOT extend finalDeadline when null', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await adjustDeadlinesForBreach(mockTx, { ...baseSubmission, finalDeadline: null }, 3);

    // Only one update call — no assignment update
    expect(mockTx.update).toHaveBeenCalledTimes(1);
  });

  it('should handle null checkpointDueDate with fallback', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    // Call with null checkpointDueDate — the code uses `new Date()` as fallback
    await adjustDeadlinesForBreach(mockTx, { ...baseSubmission, checkpointDueDate: null }, 3);

    // Should still dueDate set to some date (3 days from now in the future)
    const setCall = mockTx.set.mock.calls[0][0];
    expect(setCall.dueDate).toBeInstanceOf(Date);
    expect(setCall.dueDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('should handle null subsequent checkpoint dueDate with fallback', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve([{ id: 101, dueDate: null }]).then(onfulfilled),
    );

    await adjustDeadlinesForBreach(mockTx, baseSubmission, 2);

    // Should still update the subsequent checkpoint
    expect(mockTx.update).toHaveBeenCalledTimes(3);
    const subSetCall = mockTx.set.mock.calls[1][0];
    expect(subSetCall.dueDate).toBeInstanceOf(Date);
    expect(subSetCall.dueDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('should handle null checkpointOrder (defaults to 0)', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await adjustDeadlinesForBreach(mockTx, { ...baseSubmission, checkpointOrder: null }, 1);

    // Should not throw; subsequent checkpoints query uses `?? 0`
    expect(mockTx.update).toHaveBeenCalledTimes(2);
  });
});

describe('dispatchSLABreachNotifications', () => {
  let mockDb: any;
  const baseSubmission = {
    checkpointId: 100,
    checkpointDueDate: new Date('2026-06-01T00:00:00Z'),
    checkpointName: 'Checkpoint 1',
    checkpointOrder: 1,
    assignmentId: 10,
    assignmentTitle: 'Assignment 1',
    studentId: 'student-1',
    studentName: 'Student One',
    finalDeadline: new Date('2026-07-01T00:00:00Z'),
  };
  const adminUsers = [
    { id: 'admin-1', name: 'Admin One', email: 'admin1@test.com' },
    { id: 'admin-2', name: 'Admin Two', email: 'admin2@test.com' },
  ];

  function makeInsertMock() {
    return vi.fn().mockReturnThis();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };
  });

  it('should query admin users with role filter', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminUsers).then(onfulfilled),
    );

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    expect(mockDb.select).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.anything(),
        name: expect.anything(),
        email: expect.anything(),
      }),
    );
    expect(mockDb.from).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
  });

  it('should create in_app and email notifications per admin', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminUsers).then(onfulfilled),
    );

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    // 2 admins × (in_app + email) = 4 insert calls
    expect(mockDb.insert).toHaveBeenCalledTimes(4);
    // First two values calls = admin-1 in_app + email
    // Next two values calls = admin-2 in_app + email
    const valuesCalls = mockDb.values.mock.calls.map((c: any[]) => c[0]);

    // Each admin should have in_app and email notifications
    const admin1Notifications = valuesCalls.filter((v: any) => v.userId === 'admin-1');
    const admin2Notifications = valuesCalls.filter((v: any) => v.userId === 'admin-2');

    expect(admin1Notifications).toHaveLength(2);
    expect(admin1Notifications[0].channel).toBe('in_app');
    expect(admin1Notifications[1].channel).toBe('email');

    expect(admin2Notifications).toHaveLength(2);
    expect(admin2Notifications[0].channel).toBe('in_app');
    expect(admin2Notifications[1].channel).toBe('email');
  });

  it('should include breach metadata in notifications', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminUsers.slice(0, 1)).then(onfulfilled),
    );

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    const valuesCall = mockDb.values.mock.calls[0][0];
    expect(valuesCall.type).toBe('sla_breach');
    expect(valuesCall.titleKey).toBe('notifications.events.sla_breach.title');
    expect(valuesCall.messageKey).toBe('notifications.events.sla_breach.message');
    expect(valuesCall.params).toEqual({
      checkpointName: 'Checkpoint 1',
      assignmentTitle: 'Assignment 1',
      studentName: 'Student One',
      breachDays: '3',
    });
    expect(valuesCall.metadata).toEqual({
      assignmentId: 10,
      checkpointId: 100,
      breachDays: 3,
      assignmentTitle: 'Assignment 1',
      studentName: 'Student One',
      checkpointName: 'Checkpoint 1',
    });
  });

  it('should include limited metadata for email channel', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminUsers.slice(0, 1)).then(onfulfilled),
    );

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    const emailValuesCall = mockDb.values.mock.calls[1][0];
    expect(emailValuesCall.channel).toBe('email');
    expect(emailValuesCall.metadata).toEqual({
      assignmentId: 10,
      checkpointId: 100,
      breachDays: 3,
    });
  });

  it('should send SLA alert email for each admin', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminUsers).then(onfulfilled),
    );

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    const { sendSLAAlertEmail } = await import('@/lib/email');
    expect(sendSLAAlertEmail).toHaveBeenCalledTimes(2);
    expect(sendSLAAlertEmail).toHaveBeenCalledWith({
      adminEmail: 'admin1@test.com',
      adminName: 'Admin One',
      assignmentTitle: 'Assignment 1',
      studentName: 'Student One',
      checkpointName: 'Checkpoint 1',
      breachDays: 3,
    });
    expect(sendSLAAlertEmail).toHaveBeenCalledWith({
      adminEmail: 'admin2@test.com',
      adminName: 'Admin Two',
      assignmentTitle: 'Assignment 1',
      studentName: 'Student One',
      checkpointName: 'Checkpoint 1',
      breachDays: 3,
    });
  });

  it('should not create notifications when no admins exist', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 2);

    expect(mockDb.insert).not.toHaveBeenCalled();
    const { sendSLAAlertEmail } = await import('@/lib/email');
    expect(sendSLAAlertEmail).not.toHaveBeenCalled();
  });

  it('should catch and log errors without re-throwing', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminUsers).then(onfulfilled),
    );
    // Make insert throw after first call (admin-1 in_app succeeds, admin-1 email fails)
    mockDb.insert
      .mockImplementationOnce(() => ({ values: vi.fn().mockResolvedValue(undefined) }))
      .mockImplementationOnce(() => ({ values: vi.fn().mockRejectedValue(new Error('DB error')) }))
      .mockImplementationOnce(() => ({ values: vi.fn().mockResolvedValue(undefined) }))
      .mockImplementationOnce(() => ({ values: vi.fn().mockResolvedValue(undefined) }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should not throw
    await expect(
      dispatchSLABreachNotifications(mockDb, baseSubmission, 3),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith('Failed to send SLA notifications:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should catch and log error when admin query fails', async () => {
    const dbError = new Error('Connection failed');
    // Invoke the onrejected handler directly so await throws
    mockDb.then.mockImplementation((_onfulfilled: any, onrejected: any) => {
      onrejected(dbError);
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      dispatchSLABreachNotifications(mockDb, baseSubmission, 3),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith('Failed to send SLA notifications:', dbError);
    consoleSpy.mockRestore();
  });
});
