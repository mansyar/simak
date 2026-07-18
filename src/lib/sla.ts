/**
 * SLA breach duration calculation.
 *
 * SLA is 3 calendar days (72 hours) from submission upload time.
 * Returns the breach duration in whole days (rounded down), or 0 if on time.
 */
const SLA_MS = 3 * 24 * 60 * 60 * 1000; // 72 hours in milliseconds

export function calculateBreachDuration(anchorTime: Date, reviewedAt: Date): number {
  if (!anchorTime || !reviewedAt) return 0;

  const elapsedMs = reviewedAt.getTime() - anchorTime.getTime();
  if (elapsedMs <= SLA_MS) return 0;

  const breachMs = elapsedMs - SLA_MS;
  return Math.floor(breachMs / (1000 * 60 * 60 * 24));
}
