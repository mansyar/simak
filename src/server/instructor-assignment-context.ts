import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';

export interface InstructorAssignmentSectionStudent {
  id: string;
  name: string;
  email: string;
}

export interface InstructorAssignmentSection {
  id: number;
  label: string;
  termId: number;
  courseId: number;
  status: 'active' | 'inactive' | 'archived';
  students: InstructorAssignmentSectionStudent[];
}

export const listInstructorAssignmentSections = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async () => {
    const { listInstructorAssignmentSectionsHandler } =
      await import('./instructor-assignment-context.server');
    return listInstructorAssignmentSectionsHandler();
  });
