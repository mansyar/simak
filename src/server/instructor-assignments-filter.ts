// Client-safe server function wrapper for review-queue assignment filter
// Handler implementation is in instructor-assignments-filter.server.ts
import { createServerFn } from '@tanstack/react-start';

export const listInstructorAssignmentsForFilter = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { listInstructorAssignmentsForFilterHandler } = await import(
    './instructor-assignments-filter.server'
  );
  return listInstructorAssignmentsForFilterHandler();
});
