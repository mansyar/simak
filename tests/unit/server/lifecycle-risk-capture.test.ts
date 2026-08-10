/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { captureLifecycleRiskObservation } from '@/server/lifecycle-risk-capture.server';
import { recordRiskObservation } from '@/server/risk-observation-recorder.server';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/server/risk-observation-recorder.server', () => ({
  recordRiskObservation: vi.fn(),
}));

const input = {
  source: 'lifecycle_event' as const,
  eventType: 'review_recorded' as const,
  sourceEventId: 'review:42',
  assignmentId: 12,
  studentId: 'student-1',
  checkpointId: 8,
  actorId: 'instructor-1',
};

describe('captureLifecycleRiskObservation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records the exact lifecycle envelope', async () => {
    await captureLifecycleRiskObservation({} as any, 'submitReviewHandler', input);

    expect(recordRiskObservation).toHaveBeenCalledWith({}, input);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('keeps a committed mutation successful and logs a replayable envelope on failure', async () => {
    vi.mocked(recordRiskObservation).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(
      captureLifecycleRiskObservation({} as any, 'submitReviewHandler', input),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith({
      event: 'risk_observation_capture_failed',
      handler: 'submitReviewHandler',
      capture: input,
      error: 'storage unavailable',
    });
  });
});
