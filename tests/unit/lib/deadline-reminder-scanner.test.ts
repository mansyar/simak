/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/deadline-reminder-email', () => ({
  sendDeadlineReminderEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/risk-alerts', () => ({
  checkAndFireRiskAlert: vi.fn().mockResolvedValue(undefined),
}));

import { processDeadlineReminders } from '@/lib/deadline-reminder-scanner';
import { getDb } from '@/db/index';
import { sendDeadlineReminderEmail } from '@/lib/deadline-reminder-email';
import { checkAndFireRiskAlert } from '@/lib/risk-alerts';

describe('processDeadlineReminders', () => {
  let mockDb: any;

  const dueCheckpoints = [
    {
      checkpointId: 1,
      assignmentId: 10,
      assignmentTitle: 'Assignment 1',
      checkpointName: 'Checkpoint 1',
      dueDate: new Date('2026-07-28T00:00:00Z'),
      studentId: 'student-1',
      studentName: 'Alice',
      instructorId: 'instructor-1',
    },
  ];

  const winners = [
    { id: 1, checkpointId: 1, studentId: 'student-1', tier: '7d', sentAt: new Date() },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
      transaction: vi.fn(async (cb: any) => cb(mockDb)),
    };
    vi.mocked(getDb).mockReturnValue(mockDb as any);
  });

  // Helper: queue `then` results for a full scan where only tier 1 (7d) has results
  function queueOnlyTier1HasResults() {
    mockDb.then
      .mockImplementationOnce((onf: any) => Promise.resolve(dueCheckpoints).then(onf)) // 7d SELECT
      .mockImplementationOnce((onf: any) => Promise.resolve(winners).then(onf)) // 7d INSERT dedup
      .mockImplementationOnce((onf: any) => Promise.resolve(undefined).then(onf)) // 7d INSERT notifications
      .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 3d SELECT (empty)
      .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)); // 1d SELECT (empty)
  }

  describe('tier processing', () => {
    it('should process all 3 tiers (7d, 3d, 1d) with separate SELECT queries', async () => {
      mockDb.then
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 7d SELECT
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 3d SELECT
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)); // 1d SELECT

      await processDeadlineReminders();

      expect(mockDb.select).toHaveBeenCalledTimes(3);
    });

    it('should skip INSERT when no checkpoints are due in a tier', async () => {
      mockDb.then
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 7d SELECT (empty)
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 3d SELECT (empty)
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)); // 1d SELECT (empty)

      await processDeadlineReminders();

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(sendDeadlineReminderEmail).not.toHaveBeenCalled();
    });
  });

  describe('transaction wrapping', () => {
    it('should wrap dedup + notification inserts in db.transaction', async () => {
      queueOnlyTier1HasResults();

      await processDeadlineReminders();

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('dedup (ON CONFLICT DO NOTHING)', () => {
    it('should use onConflictDoNothing when inserting into deadline_reminders', async () => {
      queueOnlyTier1HasResults();

      await processDeadlineReminders();

      expect(mockDb.onConflictDoNothing).toHaveBeenCalled();
    });

    it('should not create notifications when dedup returns no winners', async () => {
      mockDb.then
        .mockImplementationOnce((onf: any) => Promise.resolve(dueCheckpoints).then(onf)) // 7d SELECT
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 7d INSERT dedup (no winners)
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 3d SELECT
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)); // 1d SELECT

      await processDeadlineReminders();

      // Only 1 insert (dedup), no notifications insert
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(sendDeadlineReminderEmail).not.toHaveBeenCalled();
    });

    it('should not send emails when dedup returns no winners', async () => {
      mockDb.then
        .mockImplementationOnce((onf: any) => Promise.resolve(dueCheckpoints).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // no winners
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf));

      await processDeadlineReminders();

      expect(sendDeadlineReminderEmail).not.toHaveBeenCalled();
    });
  });

  describe('notification creation', () => {
    it('should create in-app notifications with correct type, keys, and stringified params', async () => {
      queueOnlyTier1HasResults();

      await processDeadlineReminders();

      // 2 inserts: dedup (values[0]) + notifications (values[1])
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      const notifValues = mockDb.values.mock.calls[1][0];
      expect(notifValues).toHaveLength(1);

      const notif = notifValues[0];
      expect(notif.type).toBe('deadline_reminder');
      expect(notif.titleKey).toBe('notifications.events.deadline_reminder.title');
      expect(notif.messageKey).toBe('notifications.events.deadline_reminder.message');
      expect(notif.params).toEqual({
        assignmentTitle: 'Assignment 1',
        checkpointName: 'Checkpoint 1',
        dueDate: String(dueCheckpoints[0].dueDate),
      });
      expect(notif.channel).toBe('in_app');
      expect(notif.metadata).toEqual({
        assignmentId: 10,
        checkpointId: 1,
      });
    });

    it('should set userId to the studentId from the checkpoint', async () => {
      queueOnlyTier1HasResults();

      await processDeadlineReminders();

      const notifValues = mockDb.values.mock.calls[1][0];
      expect(notifValues[0].userId).toBe('student-1');
    });

    it('should batch-insert all notifications in a single INSERT', async () => {
      const twoCheckpoints = [
        {
          checkpointId: 1,
          assignmentId: 10,
          assignmentTitle: 'A1',
          checkpointName: 'C1',
          dueDate: new Date('2026-07-28T00:00:00Z'),
          studentId: 's1',
        },
        {
          checkpointId: 2,
          assignmentId: 11,
          assignmentTitle: 'A2',
          checkpointName: 'C2',
          dueDate: new Date('2026-07-29T00:00:00Z'),
          studentId: 's2',
        },
      ];
      const twoWinners = [
        { id: 1, checkpointId: 1, studentId: 's1', tier: '7d', sentAt: new Date() },
        { id: 2, checkpointId: 2, studentId: 's2', tier: '7d', sentAt: new Date() },
      ];

      mockDb.then
        .mockImplementationOnce((onf: any) => Promise.resolve(twoCheckpoints).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve(twoWinners).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve(undefined).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf));

      await processDeadlineReminders();

      // Single batch INSERT for notifications (not 2 individual inserts)
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // dedup + notifications
      const notifValues = mockDb.values.mock.calls[1][0];
      expect(Array.isArray(notifValues)).toBe(true);
      expect(notifValues).toHaveLength(2);
    });

    it('should skip in-app notification for students with inApp=false', async () => {
      const twoCheckpointsWithPrefs = [
        {
          checkpointId: 1,
          assignmentId: 10,
          assignmentTitle: 'A1',
          checkpointName: 'C1',
          dueDate: new Date('2026-07-28T00:00:00Z'),
          studentId: 's1',
          settings: { notificationPrefs: { deadline_reminder: { inApp: false } } },
        },
        {
          checkpointId: 2,
          assignmentId: 11,
          assignmentTitle: 'A2',
          checkpointName: 'C2',
          dueDate: new Date('2026-07-29T00:00:00Z'),
          studentId: 's2',
          settings: null,
        },
      ];
      const twoWinners = [
        { id: 1, checkpointId: 1, studentId: 's1', tier: '7d', sentAt: new Date() },
        { id: 2, checkpointId: 2, studentId: 's2', tier: '7d', sentAt: new Date() },
      ];

      mockDb.then
        .mockImplementationOnce((onf: any) => Promise.resolve(twoCheckpointsWithPrefs).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve(twoWinners).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve(undefined).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf));

      await processDeadlineReminders();

      // Only 1 in-app notification (s2), s1 skipped
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // dedup + notifications
      const notifValues = mockDb.values.mock.calls[1][0];
      expect(Array.isArray(notifValues)).toBe(true);
      expect(notifValues).toHaveLength(1);
      expect(notifValues[0].userId).toBe('s2');

      // Email still sent to ALL winners
      expect(sendDeadlineReminderEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('email dispatch', () => {
    it('should send an email for each winning checkpoint', async () => {
      queueOnlyTier1HasResults();

      await processDeadlineReminders();

      expect(sendDeadlineReminderEmail).toHaveBeenCalledTimes(1);
      expect(sendDeadlineReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'student-1',
          assignmentId: 10,
          assignmentTitle: 'Assignment 1',
          checkpointName: 'Checkpoint 1',
          checkpointId: 1,
          dueDate: dueCheckpoints[0].dueDate,
        }),
      );
    });

    it('should send emails via Promise.allSettled — one rejection does not throw', async () => {
      const twoCheckpoints = [
        {
          checkpointId: 1,
          assignmentId: 10,
          assignmentTitle: 'A1',
          checkpointName: 'C1',
          dueDate: new Date('2026-07-28T00:00:00Z'),
          studentId: 's1',
        },
        {
          checkpointId: 2,
          assignmentId: 11,
          assignmentTitle: 'A2',
          checkpointName: 'C2',
          dueDate: new Date('2026-07-29T00:00:00Z'),
          studentId: 's2',
        },
      ];
      const twoWinners = [
        { id: 1, checkpointId: 1, studentId: 's1', tier: '7d', sentAt: new Date() },
        { id: 2, checkpointId: 2, studentId: 's2', tier: '7d', sentAt: new Date() },
      ];

      mockDb.then
        .mockImplementationOnce((onf: any) => Promise.resolve(twoCheckpoints).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve(twoWinners).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve(undefined).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf));

      vi.mocked(sendDeadlineReminderEmail)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Email send failed'));

      // Should not throw — allSettled handles rejections
      await expect(processDeadlineReminders()).resolves.toBeUndefined();

      expect(sendDeadlineReminderEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('error isolation', () => {
    it('should catch errors per tier and continue processing other tiers', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 7d tier SELECT fails, 3d tier succeeds, 1d tier empty
      mockDb.then
        .mockImplementationOnce((_onf: any, onr: any) => {
          onr(new Error('DB error'));
        }) // 7d SELECT (rejects)
        .mockImplementationOnce((onf: any) => Promise.resolve(dueCheckpoints).then(onf)) // 3d SELECT
        .mockImplementationOnce((onf: any) => Promise.resolve(winners).then(onf)) // 3d INSERT dedup
        .mockImplementationOnce((onf: any) => Promise.resolve(undefined).then(onf)) // 3d INSERT notifications
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)); // 1d SELECT

      await processDeadlineReminders();

      expect(consoleSpy).toHaveBeenCalled();
      // 3d tier still processed: dedup + notifications = 2 inserts
      expect(mockDb.insert).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('should never throw — all errors are caught', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockDb.then.mockImplementation(() => {
        throw new Error('Catastrophic failure');
      });

      await expect(processDeadlineReminders()).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe('multiple tiers with results', () => {
    it('should process notifications for multiple tiers independently', async () => {
      const checkpoints7d = [
        {
          checkpointId: 1,
          assignmentId: 10,
          assignmentTitle: 'A1',
          checkpointName: 'C1',
          dueDate: new Date('2026-07-28T00:00:00Z'),
          studentId: 's1',
        },
      ];
      const checkpoints3d = [
        {
          checkpointId: 2,
          assignmentId: 11,
          assignmentTitle: 'A2',
          checkpointName: 'C2',
          dueDate: new Date('2026-07-25T00:00:00Z'),
          studentId: 's2',
        },
      ];
      const winners7d = [
        { id: 1, checkpointId: 1, studentId: 's1', tier: '7d', sentAt: new Date() },
      ];
      const winners3d = [
        { id: 2, checkpointId: 2, studentId: 's2', tier: '3d', sentAt: new Date() },
      ];

      mockDb.then
        // 7d tier
        .mockImplementationOnce((onf: any) => Promise.resolve(checkpoints7d).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve(winners7d).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve(undefined).then(onf))
        // 3d tier
        .mockImplementationOnce((onf: any) => Promise.resolve(checkpoints3d).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve(winners3d).then(onf))
        .mockImplementationOnce((onf: any) => Promise.resolve(undefined).then(onf))
        // 1d tier (empty)
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf));

      await processDeadlineReminders();

      // 4 inserts: 2 dedup + 2 notifications
      expect(mockDb.insert).toHaveBeenCalledTimes(4);
      // 2 emails (one per winning checkpoint)
      expect(sendDeadlineReminderEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('risk alert integration', () => {
    it('should call checkAndFireRiskAlert for each winning checkpoint', async () => {
      queueOnlyTier1HasResults();

      await processDeadlineReminders();

      expect(checkAndFireRiskAlert).toHaveBeenCalledTimes(1);
      expect(checkAndFireRiskAlert).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          studentId: 'student-1',
          studentName: 'Alice',
          assignmentId: 10,
          assignmentTitle: 'Assignment 1',
          instructorId: 'instructor-1',
        }),
      );
    });

    it('should not call checkAndFireRiskAlert when no winners (dedup)', async () => {
      mockDb.then
        .mockImplementationOnce((onf: any) => Promise.resolve(dueCheckpoints).then(onf)) // 7d SELECT
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 7d INSERT dedup (no winners)
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 3d SELECT
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)); // 1d SELECT

      await processDeadlineReminders();

      expect(checkAndFireRiskAlert).not.toHaveBeenCalled();
    });

    it('should not call checkAndFireRiskAlert when no checkpoints due', async () => {
      mockDb.then
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 7d SELECT
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)) // 3d SELECT
        .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf)); // 1d SELECT

      await processDeadlineReminders();

      expect(checkAndFireRiskAlert).not.toHaveBeenCalled();
    });

    it('should isolate risk alert failures — Promise.allSettled prevents throw', async () => {
      queueOnlyTier1HasResults();
      vi.mocked(checkAndFireRiskAlert).mockRejectedValueOnce(new Error('Risk alert failed'));

      await expect(processDeadlineReminders()).resolves.toBeUndefined();

      expect(checkAndFireRiskAlert).toHaveBeenCalledTimes(1);
    });

    it('should call checkAndFireRiskAlert with the db instance from getDb', async () => {
      queueOnlyTier1HasResults();

      await processDeadlineReminders();

      expect(checkAndFireRiskAlert).toHaveBeenCalledWith(mockDb, expect.any(Object));
    });
  });
});
