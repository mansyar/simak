import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({ RESEND_API_KEY: 'test-key' }),
}));

const { pruneMock } = vi.hoisted(() => ({
  pruneMock: vi.fn(),
}));

vi.mock('@/lib/email-queue-retention', () => ({
  pruneOldEmails: pruneMock,
}));

describe('email-queue-init', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.clearAllMocks();
    pruneMock.mockReset();
    pruneMock.mockResolvedValue({ deleted: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockProcessor(returnFn: () => Promise<any>): ReturnType<typeof vi.fn> {
    const processMock = vi.fn(returnFn);
    vi.doMock('@/lib/email-queue-processor', () => ({ processEmailQueue: processMock }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    return processMock;
  }

  it('skips overlapping ticks while a previous tick is in flight', async () => {
    const processMock = mockProcessor(() => new Promise(() => {}));
    const { startEmailQueue, stopEmailQueue } = await import('@/lib/email-queue-init');

    startEmailQueue();
    expect(processMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(processMock).toHaveBeenCalledTimes(1);
    stopEmailQueue();
  });

  it('resets isRunning guard after a tick errors so the next tick runs', async () => {
    let call = 0;
    const processMock = mockProcessor(() => {
      call += 1;
      return call === 1 ? Promise.reject(new Error('tick failed')) : Promise.resolve();
    });
    const { startEmailQueue, stopEmailQueue } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(processMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(processMock).toHaveBeenCalledTimes(2);
    stopEmailQueue();
  });

  it('logs structured error when tick throws', async () => {
    mockProcessor(() => Promise.reject(new Error('tick failed')));
    const { startEmailQueue, stopEmailQueue } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    const errorLog = (console.error as Mock).mock.calls.find(
      (call: any[]) => call[0]?.event === 'email_queue.tick_error',
    );
    expect(errorLog).toBeTruthy();
    expect(errorLog![0]).toMatchObject({
      event: 'email_queue.tick_error',
      error: 'tick failed',
      willRetryNextInterval: true,
    });
    stopEmailQueue();
  });

  it('calls pruneOldEmails on first tick (lastPruneAt is null)', async () => {
    mockProcessor(() => Promise.resolve());
    pruneMock.mockResolvedValue({ deleted: 3 });
    const { startEmailQueue, stopEmailQueue } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    expect(pruneMock).toHaveBeenCalledTimes(1);
    stopEmailQueue();
  });

  it('does not call pruneOldEmails again within 24h of last prune', async () => {
    mockProcessor(() => Promise.resolve());
    pruneMock.mockResolvedValue({ deleted: 0 });
    const { startEmailQueue, stopEmailQueue } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(pruneMock).toHaveBeenCalledTimes(1);

    // Several ticks within 24h — prune should NOT be called again
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(30_000);
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(pruneMock).toHaveBeenCalledTimes(1);

    stopEmailQueue();
  });

  it('calls pruneOldEmails again after >24h since last prune', async () => {
    mockProcessor(() => Promise.resolve());
    pruneMock.mockResolvedValue({ deleted: 2 });
    const { startEmailQueue, stopEmailQueue } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);
    expect(pruneMock).toHaveBeenCalledTimes(1);

    // Advance past 24h
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(pruneMock).toHaveBeenCalledTimes(2);

    stopEmailQueue();
  });

  it('logs email_queue.retention_pruned with deleted count and no PII', async () => {
    mockProcessor(() => Promise.resolve());
    pruneMock.mockResolvedValue({ deleted: 5 });
    const { startEmailQueue, stopEmailQueue } = await import('@/lib/email-queue-init');

    startEmailQueue();
    await vi.advanceTimersByTimeAsync(0);

    const pruneLog = (console.info as Mock).mock.calls.find(
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
    stopEmailQueue();
  });
});
