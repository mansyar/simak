/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adjustDeadlinesForBreach, dispatchSLABreachNotifications } from '@/lib/review-sla';
import { logger } from '@/lib/logger';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

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

    expect(mockTx.update).toHaveBeenCalledTimes(2); // affected + bulk subsequent
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

    // With bulk UPDATE: 2 calls (affected + 1 bulk for all subsequent)
    expect(mockTx.update).toHaveBeenCalledTimes(2);
    // Bulk UPDATE uses SQL expression for dueDate
    const bulkSetCall = mockTx.set.mock.calls[1][0];
    expect(bulkSetCall.dueDate).toBeDefined();
    expect(bulkSetCall.updatedAt).toBeInstanceOf(Date);
  });

  it('should query subsequent checkpoints with correct filters', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await adjustDeadlinesForBreach(mockTx, baseSubmission, 1);

    // No SELECT for subsequent checkpoints (replaced by bulk UPDATE)
    expect(mockTx.select).not.toHaveBeenCalled();
    expect(mockTx.where).toHaveBeenCalled();
  });

  it('should never extend assignment finalDeadline', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await adjustDeadlinesForBreach(mockTx, baseSubmission, 3);

    const finalDeadlineCalls = mockTx.set.mock.calls.filter(
      (call: any[]) => 'finalDeadline' in call[0],
    );
    expect(finalDeadlineCalls).toHaveLength(0);
  });

  it('should NOT extend finalDeadline when null', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await adjustDeadlinesForBreach(mockTx, { ...baseSubmission, finalDeadline: null }, 3);

    // Two update calls — affected checkpoint + bulk subsequent (no assignment update)
    expect(mockTx.update).toHaveBeenCalledTimes(2);
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

    // Should still update affected + bulk subsequent
    expect(mockTx.update).toHaveBeenCalledTimes(2);
    // Bulk UPDATE uses SQL COALESCE for null handling (not JS Date fallback)
    const subSetCall = mockTx.set.mock.calls[1][0];
    expect(subSetCall.dueDate).toBeDefined();
    expect(subSetCall.dueDate).not.toBeInstanceOf(Date);
  });

  it('should handle null checkpointOrder (defaults to 0)', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await adjustDeadlinesForBreach(mockTx, { ...baseSubmission, checkpointOrder: null }, 1);

    // Should not throw; bulk UPDATE WHERE clause uses `?? 0`
    expect(mockTx.update).toHaveBeenCalledTimes(2);
  });

  it('should use single bulk UPDATE for subsequent checkpoints (PERF-4)', async () => {
    // Mock subsequent checkpoints being returned (old code would loop through these)
    mockTx.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve([
        { id: 101, dueDate: new Date('2026-06-10T00:00:00Z') },
        { id: 102, dueDate: new Date('2026-06-20T00:00:00Z') },
        { id: 103, dueDate: new Date('2026-06-30T00:00:00Z') },
      ]).then(onfulfilled),
    );

    await adjustDeadlinesForBreach(mockTx, baseSubmission, 2);

    // With bulk UPDATE: 2 UPDATE calls (1 affected + 1 bulk)
    // Old code would make 4 UPDATE calls (1 affected + 3 individual)
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

  it('should create only in_app notifications per admin (not email rows)', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminUsers).then(onfulfilled),
    );

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    // Single batch INSERT for all admins (PERF-5)
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(Array.isArray(valuesArg)).toBe(true);
    expect(valuesArg).toHaveLength(2);

    // Each admin should have only in_app notification (no email rows)
    valuesArg.forEach((v: any) => {
      expect(v.channel).toBe('in_app');
    });

    // Verify no email channel rows were inserted
    const emailNotifications = valuesArg.filter((v: any) => v.channel === 'email');
    expect(emailNotifications).toHaveLength(0);
  });

  it('should include breach metadata in notifications', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminUsers.slice(0, 1)).then(onfulfilled),
    );

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    // Batch insert: values receives an array
    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(Array.isArray(valuesArg)).toBe(true);
    const notif = valuesArg[0];
    expect(notif.type).toBe('sla_breach');
    expect(notif.titleKey).toBe('notifications.events.sla_breach.title');
    expect(notif.messageKey).toBe('notifications.events.sla_breach.message');
    expect(notif.params).toEqual({
      checkpointName: 'Checkpoint 1',
      assignmentTitle: 'Assignment 1',
      studentName: 'Student One',
      breachDays: '3',
    });
    expect(notif.metadata).toEqual({
      assignmentId: 10,
      checkpointId: 100,
      breachDays: 3,
      assignmentTitle: 'Assignment 1',
      studentName: 'Student One',
      checkpointName: 'Checkpoint 1',
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

  it('should use single batch INSERT for all admin notifications (PERF-5)', async () => {
    const threeAdmins = [
      { id: 'admin-1', name: 'Admin One', email: 'admin1@test.com' },
      { id: 'admin-2', name: 'Admin Two', email: 'admin2@test.com' },
      { id: 'admin-3', name: 'Admin Three', email: 'admin3@test.com' },
    ];
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(threeAdmins).then(onfulfilled),
    );

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    // Single batch INSERT, not 3 individual inserts
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(Array.isArray(valuesArg)).toBe(true);
    expect(valuesArg).toHaveLength(3);
    expect(valuesArg.map((v: any) => v.userId)).toEqual(['admin-1', 'admin-2', 'admin-3']);
  });

  it('should send SLA alert emails concurrently via Promise.allSettled (PERF-5)', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminUsers).then(onfulfilled),
    );

    // Make one email reject — Promise.allSettled should not throw
    const { sendSLAAlertEmail } = await import('@/lib/email');
    vi.mocked(sendSLAAlertEmail)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Email send failed'));

    // Should not throw — allSettled handles rejections internally
    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    // Both emails attempted (allSettled doesn't short-circuit)
    expect(sendSLAAlertEmail).toHaveBeenCalledTimes(2);
    // No error logged — allSettled catches rejections internally
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should catch and log errors without re-throwing', async () => {
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminUsers).then(onfulfilled),
    );
    // Make the batch insert throw
    mockDb.insert.mockImplementationOnce(() => ({
      values: vi.fn().mockRejectedValue(new Error('DB error')),
    }));

    // Should not throw
    await expect(
      dispatchSLABreachNotifications(mockDb, baseSubmission, 3),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'advisory_failed',
        handler: 'sendSlaNotifications',
      }),
    );
  });

  it('should catch and log error when admin query fails', async () => {
    const dbError = new Error('Connection failed');
    // Invoke the onrejected handler directly so await throws
    mockDb.then.mockImplementation((_onfulfilled: any, onrejected: any) => {
      onrejected(dbError);
    });

    await expect(
      dispatchSLABreachNotifications(mockDb, baseSubmission, 3),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'advisory_failed',
        handler: 'sendSlaNotifications',
      }),
    );
  });

  it('should skip in-app notification for admins with inApp=false but still email all', async () => {
    const adminsWithPrefs = [
      {
        id: 'admin-1',
        name: 'Admin One',
        email: 'admin1@test.com',
        settings: { notificationPrefs: { sla_breach: { inApp: false } } },
      },
      { id: 'admin-2', name: 'Admin Two', email: 'admin2@test.com', settings: null },
    ];
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(adminsWithPrefs).then(onfulfilled),
    );

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    // Only 1 in-app notification (admin-2), admin-1 skipped
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const valuesArg = mockDb.values.mock.calls[0][0];
    expect(Array.isArray(valuesArg)).toBe(true);
    expect(valuesArg).toHaveLength(1);
    expect(valuesArg[0].userId).toBe('admin-2');

    // Email still sent to ALL admins (sla_alert exempt from email gate per FR-8)
    const { sendSLAAlertEmail } = await import('@/lib/email');
    expect(sendSLAAlertEmail).toHaveBeenCalledTimes(2);
  });

  it('should skip all in-app notifications when all admins have inApp=false', async () => {
    const allDisabled = [
      {
        id: 'admin-1',
        name: 'Admin One',
        email: 'admin1@test.com',
        settings: { notificationPrefs: { sla_breach: { inApp: false } } },
      },
      {
        id: 'admin-2',
        name: 'Admin Two',
        email: 'admin2@test.com',
        settings: { notificationPrefs: { sla_breach: { inApp: false } } },
      },
    ];
    mockDb.then.mockImplementation((onfulfilled: any) =>
      Promise.resolve(allDisabled).then(onfulfilled),
    );

    await dispatchSLABreachNotifications(mockDb, baseSubmission, 3);

    // No notification INSERT at all
    expect(mockDb.insert).not.toHaveBeenCalled();

    // Email still sent to ALL admins
    const { sendSLAAlertEmail } = await import('@/lib/email');
    expect(sendSLAAlertEmail).toHaveBeenCalledTimes(2);
  });
});
