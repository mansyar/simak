// Client-safe academic-record server-function wrappers.
// Handler implementations live in academic-records-extras.server.ts.
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import type { ServerError } from '@/lib/errors';
import { z } from 'zod';
import type { GpaCalculation } from '@/lib/academic-record-policy';

export type AcademicRecordView = {
  recordId: number;
  studentId: string;
  studentName?: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  courseSectionId: number;
  sectionCode: string;
  termId: number;
  termCode: string;
  termName: string;
  termStartDate: string;
  sourceAssignmentId: number;
  sourceSnapshotId: number | null;
  sourceReleaseVersion: number | null;
  policyVersion: number;
  recordVersion: number;
  numericScore: number | null;
  letterGrade: string | null;
  status: 'complete' | 'incomplete' | 'withdrawn';
  credits: number;
  gradePoints: number | null;
  roundingScale: number | null;
  publishedAt: Date | string | null;
  createdAt: Date | string;
};

export type AcademicRecordsResponse = {
  records: AcademicRecordView[];
  terms: Array<{ id: number; code: string; name: string }>;
  page: number;
  limit: number;
  total: number;
  termGpa: GpaCalculation | null;
  cumulativeGpa: GpaCalculation | null;
};

export type AcademicRecordsResult = AcademicRecordsResponse | ServerError;

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
