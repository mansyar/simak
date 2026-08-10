import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({ RESEND_API_KEY: 'test-key' }),
}));

const {
  mockChildLogger,
  pruneMock,
  scannerMock,
  appointmentScannerMock,
  r2CleanupMock,
  riskHistoryMock,
  reclaimMock,
} = vi.hoisted(() => ({
  mockChildLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  pruneMock: vi.fn(),
  scannerMock: vi.fn(),
  appointmentScannerMock: vi.fn(),
  r2CleanupMock: vi.fn(),
  riskHistoryMock: vi.fn(),
  reclaimMock: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    child: vi.fn().mockReturnValue(mockChildLogger),
  },
}));

vi.mock('@/lib/email-queue-retention', () => ({
  pruneOldEmails: pruneMock,
}));

vi.mock('@/lib/deadline-reminder-scanner', () => ({
  processDeadlineReminders: scannerMock,
}));

vi.mock('@/lib/appointment-reminder-scanner', () => ({
  processAppointmentReminders: appointmentScannerMock,
}));

vi.mock('@/lib/r2-cleanup', () => ({
  processOrphanedR2Objects: r2CleanupMock,
}));

vi.mock('@/server/risk-history-jobs.server', () => ({
  processRiskHistoryJobs: riskHistoryMock,
}));

describe('email-queue-init', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.clearAllMocks();
    pruneMock.mockReset();
    pruneMock.mockResolvedValue({ deleted: 0 });
    scannerMock.mockReset();
    scannerMock.mockResolvedValue(undefined);
    appointmentScannerMock.mockReset();
    appointmentScannerMock.mockResolvedValue(undefined);
    r2CleanupMock.mockReset();
    r2CleanupMock.mockResolvedValue({ deleted: 0, failed: 0, batchSize: 0 });
    riskHistoryMock.mockReset();
    riskHistoryMock.mockResolvedValue({
      snapshots: { scanned: 0, created: 0, hasMore: false },
      retention: { scanned: 0, anonymized: 0, hasMore: false },
      complete: true,
    });
    reclaimMock.mockReset();
    reclaimMock.mockResolvedValue({ reclaimed: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockProcessor(returnFn: () => Promise<any>): ReturnType<typeof vi.fn> {
    const processMock = vi.fn(returnFn);
    vi.doMock('@/lib/email-queue-processor', () => ({
      processEmailQueue: processMock,
      reclaimAllProcessingRows: reclaimMock,
    }));
    return processMock;
  }

  it('skips overlapping ticks while a previous tick is in flight', async () => {
    let resolveTick!: () => void;
    const processMock = mockProcessor(
      () =>
        new Promise<void>((resolve) => {
          resolveTick = resolve;
        }),
    );
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(processMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(processMock).toHaveBeenCalledTimes(1);
    resolveTick();
    await stopGracefully();
  });

  it('resets isRunning guard after a tick errors so the next tick runs', async () => {
    let call = 0;
    const processMock = mockProcessor(() => {
      call += 1;
      return call === 1 ? Promise.reject(new Error('tick failed')) : Promise.resolve();
    });
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(processMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(processMock).toHaveBeenCalledTimes(2);
    await stopGracefully();
  });

  it('logs structured error when tick throws', async () => {
    mockProcessor(() => Promise.reject(new Error('tick failed')));
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    const errorLog = mockChildLogger.error.mock.calls.find(
      (call: any[]) => call[0]?.event === 'email_queue.tick_error',
    );
    expect(errorLog).toBeTruthy();
    expect(errorLog![0]).toMatchObject({
      event: 'email_queue.tick_error',
      error: 'tick failed',
      willRetryNextInterval: true,
    });
    await stopGracefully();
  });

  it('calls pruneOldEmails on first tick (lastPruneAt is null)', async () => {
    mockProcessor(() => Promise.resolve());
    pruneMock.mockResolvedValue({ deleted: 3 });
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    expect(pruneMock).toHaveBeenCalledTimes(1);
    await stopGracefully();
  });

  it('runs risk history snapshot and retention processing once per day', async () => {
    mockProcessor(() => Promise.resolve());
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(riskHistoryMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(riskHistoryMock).toHaveBeenCalledTimes(1);

    await stopGracefully();
  });

  it('logs risk history failures and retries on the next tick', async () => {
    mockProcessor(() => Promise.resolve());
    riskHistoryMock
      .mockRejectedValueOnce(new Error('risk history unavailable'))
      .mockResolvedValueOnce({
        snapshots: { scanned: 1, created: 1, hasMore: false },
        retention: { scanned: 0, anonymized: 0, hasMore: false },
        complete: true,
      });
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(mockChildLogger.error).toHaveBeenCalledWith({
      event: 'risk_history.daily_failed',
      error: 'risk history unavailable',
      willRetryNextInterval: true,
    });

    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(riskHistoryMock).toHaveBeenCalledTimes(2);

    await stopGracefully();
  });

  it('does not call pruneOldEmails again within 24h of last prune', async () => {
    mockProcessor(() => Promise.resolve());
    pruneMock.mockResolvedValue({ deleted: 0 });
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(pruneMock).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(30_000);
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(pruneMock).toHaveBeenCalledTimes(1);

    await stopGracefully();
  });

  it('calls pruneOldEmails again after >24h since last prune', async () => {
    mockProcessor(() => Promise.resolve());
    pruneMock.mockResolvedValue({ deleted: 2 });
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(pruneMock).toHaveBeenCalledTimes(1);

    // Advance past 24h
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(pruneMock).toHaveBeenCalledTimes(2);

    await stopGracefully();
  });

  it('logs email_queue.retention_pruned with deleted count and no PII', async () => {
    mockProcessor(() => Promise.resolve());
    pruneMock.mockResolvedValue({ deleted: 5 });
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    const pruneLog = mockChildLogger.info.mock.calls.find(
      (call: any[]) => call[0]?.event === 'email_queue.retention_pruned',
    );
    expect(pruneLog).toBeTruthy();
    expect(pruneLog![0]).toMatchObject({
      event: 'email_queue.retention_pruned',
      deleted: 5,
    });
    const logJson = JSON.stringify(pruneLog![0]);
    expect(logJson).not.toContain('@');
    expect(logJson).not.toContain('recipient');
    expect(logJson).not.toContain('subject');
    await stopGracefully();
  });

  it('calls processDeadlineReminders on first tick (lastReminderScanAt is null)', async () => {
    mockProcessor(() => Promise.resolve());
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    expect(scannerMock).toHaveBeenCalledTimes(1);
    await stopGracefully();
  });

  it('does not call processDeadlineReminders again within 1h of last scan', async () => {
    mockProcessor(() => Promise.resolve());
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(scannerMock).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(30_000);
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(scannerMock).toHaveBeenCalledTimes(1);

    await stopGracefully();
  });

  it('calls processDeadlineReminders again after >1h since last scan', async () => {
    mockProcessor(() => Promise.resolve());
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(scannerMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60 * 60 * 1000 + 1_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(scannerMock).toHaveBeenCalledTimes(2);

    await stopGracefully();
  });

  it('runs appointment reminders through the existing email queue tick', async () => {
    mockProcessor(() => Promise.resolve());
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    expect(appointmentScannerMock).toHaveBeenCalledTimes(1);

    await stopGracefully();
  });

  it('isolates appointment reminder scanner failure from email processing', async () => {
    const processMock = mockProcessor(() => Promise.resolve());
    appointmentScannerMock.mockRejectedValueOnce(new Error('appointment scan failed'));
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(processMock).toHaveBeenCalledTimes(1);
    expect(appointmentScannerMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(processMock).toHaveBeenCalledTimes(2);

    await stopGracefully();
  });

  it('scanner failure is isolated — email processing continues on next tick', async () => {
    const processMock = mockProcessor(() => Promise.resolve());
    scannerMock.mockRejectedValueOnce(new Error('scanner failed'));
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(processMock).toHaveBeenCalledTimes(1);
    expect(scannerMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(processMock).toHaveBeenCalledTimes(2);

    await stopGracefully();
  });

  it('logs structured error when scanner throws but tick continues to prune', async () => {
    mockProcessor(() => Promise.resolve());
    scannerMock.mockRejectedValueOnce(new Error('scanner failed'));
    pruneMock.mockResolvedValue({ deleted: 7 });
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    const errorLog = mockChildLogger.error.mock.calls.find(
      (call: any[]) => call[0]?.event === 'deadline_reminder.scan_error',
    );
    expect(errorLog).toBeTruthy();
    expect(errorLog![0]).toMatchObject({
      event: 'deadline_reminder.scan_error',
      error: 'scanner failed',
    });

    expect(pruneMock).toHaveBeenCalledTimes(1);
    await stopGracefully();
  });

  it('calls processOrphanedR2Objects on first tick (lastR2CleanupAt is null)', async () => {
    mockProcessor(() => Promise.resolve());
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    expect(r2CleanupMock).toHaveBeenCalledTimes(1);
    await stopGracefully();
  });

  it('does not call processOrphanedR2Objects again within 6h of last cleanup', async () => {
    mockProcessor(() => Promise.resolve());
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(r2CleanupMock).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(30_000);
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(r2CleanupMock).toHaveBeenCalledTimes(1);

    await stopGracefully();
  });

  it('calls processOrphanedR2Objects again after >6h since last cleanup', async () => {
    mockProcessor(() => Promise.resolve());
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(r2CleanupMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(6 * 60 * 60 * 1000 + 1_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(r2CleanupMock).toHaveBeenCalledTimes(2);

    await stopGracefully();
  });

  it('R2 cleanup failure is isolated — email processing continues on next tick', async () => {
    const processMock = mockProcessor(() => Promise.resolve());
    r2CleanupMock.mockRejectedValueOnce(new Error('r2 cleanup failed'));
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(processMock).toHaveBeenCalledTimes(1);
    expect(r2CleanupMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(processMock).toHaveBeenCalledTimes(2);

    await stopGracefully();
  });

  it('logs structured error when R2 cleanup throws', async () => {
    mockProcessor(() => Promise.resolve());
    r2CleanupMock.mockRejectedValueOnce(new Error('r2 cleanup failed'));
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    const errorLog = mockChildLogger.error.mock.calls.find(
      (call: any[]) => call[0]?.event === 'r2_cleanup_scanner_failed',
    );
    expect(errorLog).toBeTruthy();
    expect(errorLog![0]).toMatchObject({
      event: 'r2_cleanup_scanner_failed',
      error: 'r2 cleanup failed',
    });

    await stopGracefully();
  });

  it('calls reclaimAllProcessingRows before first tick on startEmailQueue', async () => {
    const processMock = mockProcessor(() => Promise.resolve());
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    expect(reclaimMock).toHaveBeenCalledTimes(1);
    expect(processMock).toHaveBeenCalledTimes(1);
    await stopGracefully();
  });

  it('stopGracefully is a no-op when startEmailQueue was never called', async () => {
    mockProcessor(() => Promise.resolve());
    const { stopGracefully } = await import('@/lib/email-queue-init');
    await expect(stopGracefully()).resolves.not.toThrow();
  });

  it('stopGracefully awaits in-flight tick before resolving', async () => {
    let resolveTick!: () => void;
    const processMock = mockProcessor(
      () =>
        new Promise<void>((resolve) => {
          resolveTick = resolve;
        }),
    );
    const { startEmailQueue, stopGracefully } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    expect(processMock).toHaveBeenCalledTimes(1);

    let stopResolved = false;
    stopGracefully().then(() => {
      stopResolved = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(stopResolved).toBe(false);

    resolveTick();
    await vi.advanceTimersByTimeAsync(0);

    expect(stopResolved).toBe(true);
  });
});
