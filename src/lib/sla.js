/**
 * SLA breach duration calculation.
 *
 * SLA is 3 calendar days (72 hours) from when the checkpoint transitioned to `under_review`.
 * Returns the breach duration in whole days (rounded down), or 0 if on time.
 */
const SLA_MS = 3 * 24 * 60 * 60 * 1000; // 72 hours in milliseconds
export function calculateBreachDuration(underReviewAt, reviewedAt) {
  if (!underReviewAt || !reviewedAt) return 0;
  const elapsedMs = reviewedAt.getTime() - underReviewAt.getTime();
  if (elapsedMs <= SLA_MS) return 0;
  const breachMs = elapsedMs - SLA_MS;
  return Math.floor(breachMs / (1000 * 60 * 60 * 24));
}
