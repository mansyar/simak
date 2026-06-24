import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({ RESEND_API_KEY: 'test-key' }),
}));

describe('email-queue-init', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockProcessor(returnFn: () => Promise<any>): ReturnType<typeof vi.fn> {
    const processMock = vi.fn(returnFn);
    vi.doMock('@/lib/email-queue-processor', () => ({ processEmailQueue: processMock }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
});
