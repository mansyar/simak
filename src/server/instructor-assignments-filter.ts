// Client-safe server function wrapper for review-queue assignment filter
// Handler implementation is in instructor-assignments-filter.server.ts
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { listInstructorAssignmentsForFilterHandler } from './instructor-assignments-filter.server';

export const listInstructorAssignmentsForFilter = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async () => {
    return listInstructorAssignmentsForFilterHandler();
  });
