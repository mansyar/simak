/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockStopGracefully, mockCloseDb, mockLogger } = vi.hoisted(() => ({
  mockStopGracefully: vi.fn(),
  mockCloseDb: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/email-queue-init', () => ({
  stopGracefully: mockStopGracefully,
}));

vi.mock('@/db/index', () => ({
  closeDb: mockCloseDb,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/config/env', () => ({
  getEnv: vi.fn(() => ({
    SHUTDOWN_TIMEOUT_MS: 10000,
  })),
}));

describe('shutdown', () => {
  let onHandlers: Record<string, (...args: any[]) => void>;
  let exitMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();

    onHandlers = {};
    exitMock = vi.fn();

    vi.spyOn(process, 'on').mockImplementation(((event: string, handler: any) => {
      onHandlers[event] = handler;
      return process;
    }) as any);
    vi.spyOn(process, 'exit').mockImplementation(exitMock as any);

    mockStopGracefully.mockResolvedValue(undefined);
    mockCloseDb.mockResolvedValue(undefined);

    (import.meta.env as any).SSR = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('registers SIGTERM and SIGINT handlers when SSR is true', async () => {
    const { registerShutdownHandlers } = await import('@/lib/shutdown');
    registerShutdownHandlers();

    expect(onHandlers['SIGTERM']).toBeDefined();
    expect(onHandlers['SIGINT']).toBeDefined();
  });

  it('is a no-op when SSR is false', async () => {
    (import.meta.env as any).SSR = false;
    const { registerShutdownHandlers } = await import('@/lib/shutdown');
    registerShutdownHandlers();

    expect(process.on).not.toHaveBeenCalled();
  });

  it('first SIGTERM triggers stopGracefully, closeDb, and exit(0)', async () => {
    const { registerShutdownHandlers } = await import('@/lib/shutdown');
    registerShutdownHandlers();

    onHandlers['SIGTERM']();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockStopGracefully).toHaveBeenCalledTimes(1);
    expect(mockCloseDb).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('first SIGINT triggers same drain as SIGTERM', async () => {
    const { registerShutdownHandlers } = await import('@/lib/shutdown');
    registerShutdownHandlers();

    onHandlers['SIGINT']();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockStopGracefully).toHaveBeenCalledTimes(1);
    expect(mockCloseDb).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('second signal during drain immediately calls exit(1)', async () => {
    mockStopGracefully.mockReturnValue(new Promise<void>(() => {}));

    const { registerShutdownHandlers } = await import('@/lib/shutdown');
    registerShutdownHandlers();

    onHandlers['SIGTERM']();
    await vi.advanceTimersByTimeAsync(0);

    onHandlers['SIGINT']();
    await vi.advanceTimersByTimeAsync(0);

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'shutdown.force_exit' }),
    );
  });

  it('timeout forces exit(1) when drain does not complete in time', async () => {
    mockStopGracefully.mockReturnValue(new Promise<void>(() => {}));

    const { registerShutdownHandlers } = await import('@/lib/shutdown');
    registerShutdownHandlers();

    onHandlers['SIGTERM']();
    await vi.advanceTimersByTimeAsync(0);

    vi.advanceTimersByTime(10001);

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'shutdown.timeout' }),
    );
  });
});
