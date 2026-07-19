/**
 * Calculate cumulative dueDates from estimated_durations.
 * CP1 dueDate = baseDate + CP1.duration
 * CPn dueDate = baseDate + Σ(CP1..CPn.duration) days
 */
export function calculateDueDates(
  checkpoints: { order: number; estimatedDuration: number | null }[],
  baseDate: Date,
): Map<number, Date> {
  const dueDates = new Map<number, Date>();
  let cumulativeDays = 0;

  for (const cp of checkpoints) {
    cumulativeDays += cp.estimatedDuration ?? 0;
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + cumulativeDays);
    dueDates.set(cp.order, dueDate);
  }

  return dueDates;
}

/**
 * Validate that checkpoint dueDates are sequentially ordered (CP1 < CP2 < CP3 ...)
 * and that no dueDates are in the past. When `finalDeadline` is provided, also
 * rejects any checkpoint dueDate exceeding the assignment's course-wide finalDeadline
 * (enforced only at assignment creation time, not during per-student extensions).
 */
export function validateDueDates(
  dueDates: Map<number, Date>,
  finalDeadline?: Date,
): { valid: true } | { valid: false; error: string } {
  const ordered = [...dueDates.entries()].sort((a, b) => a[0] - b[0]);

  // Sequential ordering: each must be after the previous
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i][1] <= ordered[i - 1][1]) {
      return {
        valid: false,
        error: `Checkpoint ${ordered[i][0]} dueDate must be after checkpoint ${ordered[i - 1][0]}`,
      };
    }
  }

  // No past dueDates
  const now = new Date();
  for (const [order, dueDate] of ordered) {
    if (dueDate < now) {
      return {
        valid: false,
        error: `Checkpoint ${order} dueDate must not be in the past`,
      };
    }
  }

  // finalDeadline cap (assignment creation only — extensions may exceed it)
  if (finalDeadline) {
    for (const [order, dueDate] of ordered) {
      if (dueDate > finalDeadline) {
        return {
          valid: false,
          error: `Checkpoint ${order} dueDate must not exceed the assignment finalDeadline (${finalDeadline.toISOString()})`,
        };
      }
    }
  }

  return { valid: true };
}
