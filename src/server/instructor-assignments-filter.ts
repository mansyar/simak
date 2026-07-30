// Client-safe server function wrapper for review-queue assignment filter
// Handler implementation is in instructor-assignments-filter.server.ts
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { typedServerFn } from '@/lib/server-fn';

export const listInstructorAssignmentsForFilter = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
}).handler(async () => {
  const { listInstructorAssignmentsForFilterHandler } =
    await import('./instructor-assignments-filter.server');
  return listInstructorAssignmentsForFilterHandler();
});
