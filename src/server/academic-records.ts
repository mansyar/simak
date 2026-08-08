// Client-safe academic-record server-function wrappers.
// Handler implementations live in academic-records-extras.server.ts.
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

const PageSchema = z.coerce.number().int().min(1).default(1);
const LimitSchema = z.coerce.number().int().min(1).max(100).default(20);
const IdSchema = z.coerce.number().int().positive();

const AcademicRecordQuerySchema = z.object({
  termId: IdSchema.optional(),
  page: PageSchema,
  limit: LimitSchema,
});

export const GetStudentAcademicRecordsSchema = AcademicRecordQuerySchema;

export const GetInstructorAcademicRecordsSchema = AcademicRecordQuerySchema.extend({
  sectionId: IdSchema,
});

export const GetAdminAcademicRecordsSchema = AcademicRecordQuerySchema.extend({
  studentId: z.string().trim().min(1).optional(),
  sectionId: IdSchema.optional(),
  status: z.enum(['complete', 'incomplete', 'withdrawn']).optional(),
});

export type GetStudentAcademicRecordsInput = z.infer<typeof GetStudentAcademicRecordsSchema>;
export type GetInstructorAcademicRecordsInput = z.infer<typeof GetInstructorAcademicRecordsSchema>;
export type GetAdminAcademicRecordsInput = z.infer<typeof GetAdminAcademicRecordsSchema>;

export const getStudentAcademicRecords = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(GetStudentAcademicRecordsSchema)
  .handler(async ({ data }) => {
    const { getStudentAcademicRecordsHandler } = await import('./academic-records-extras.server');
    return getStudentAcademicRecordsHandler({ data });
  });

export const getInstructorAcademicRecords = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(GetInstructorAcademicRecordsSchema)
  .handler(async ({ data }) => {
    const { getInstructorAcademicRecordsHandler } =
      await import('./academic-records-extras.server');
    return getInstructorAcademicRecordsHandler({ data });
  });

export const getAdminAcademicRecords = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(GetAdminAcademicRecordsSchema)
  .handler(async ({ data }) => {
    const { getAdminAcademicRecordsHandler } = await import('./academic-records-extras.server');
    return getAdminAcademicRecordsHandler({ data });
  });
