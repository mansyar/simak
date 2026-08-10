import type { Db } from '@/db';
import { logger } from '@/lib/logger';
import {
  recordRiskObservation,
  type RecordRiskObservationInput,
} from '@/server/risk-observation-recorder.server';

type LifecycleInput = Extract<RecordRiskObservationInput, { source: 'lifecycle_event' }>;

/** Runs lifecycle capture as isolated, replayable post-commit advisory work. */
export async function captureLifecycleRiskObservation(
  db: Db,
  handler: string,
  capture: LifecycleInput,
) {
  try {
    await recordRiskObservation(db, capture);
  } catch (error) {
    logger.error({
      event: 'risk_observation_capture_failed',
      handler,
      capture,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
