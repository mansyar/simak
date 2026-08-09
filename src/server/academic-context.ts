// Client-safe academic context server-function wrappers.
// Handler implementations live in academic-context.server.ts.
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const AcademicTermStatusSchema = z.enum(['draft', 'active', 'closed', 'archived']);
export const CourseSectionStatusSchema = z.enum(['active', 'inactive', 'archived']);
export const SectionEnrollmentRoleSchema = z.enum(['instructor', 'student']);

const PageSchema = z.coerce.number().int().min(1).default(1);
const LimitSchema = z.coerce.number().int().min(1).max(100).default(20);
const IdSchema = z.coerce.number().int().positive();
const DateRangeSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine(({ startDate, endDate }) => startDate <= endDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

export const AcademicTermIdSchema = z.object({ id: IdSchema });

export const CreateAcademicTermSchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(120),
    status: AcademicTermStatusSchema.default('draft'),
  })
  .and(DateRangeSchema);

export const UpdateAcademicTermSchema = CreateAcademicTermSchema.and(AcademicTermIdSchema);

export const ListAcademicTermsSchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
  search: z.string().trim().default(''),
  status: AcademicTermStatusSchema.or(z.literal('')).optional().default(''),
});

export const CourseIdSchema = z.object({ id: IdSchema });

export const CreateCourseSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  credits: z.coerce
    .number()
    .finite()
    .positive()
    .max(999.99)
    .refine((value) => Number.isInteger(value * 100), 'Credits must use at most two decimals'),
});

export const UpdateCourseSchema = CreateCourseSchema.and(CourseIdSchema);

export const ListCoursesSchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
  search: z.string().trim().default(''),
});

export const CourseSectionIdSchema = z.object({ id: IdSchema });

export const CreateCourseSectionSchema = z.object({
  termId: IdSchema,
  courseId: IdSchema,
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().max(160).nullable().optional(),
  status: CourseSectionStatusSchema.default('active'),
});

export const UpdateCourseSectionSchema = CreateCourseSectionSchema.and(CourseSectionIdSchema);

export const ListCourseSectionsSchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
  termId: IdSchema.optional(),
  courseId: IdSchema.optional(),
  status: CourseSectionStatusSchema.or(z.literal('')).optional().default(''),
  search: z.string().trim().default(''),
});

export const AddSectionEnrollmentSchema = z.object({
  sectionId: IdSchema,
  userId: z.string().trim().min(1),
  role: SectionEnrollmentRoleSchema,
  isActive: z.boolean().default(true),
});

export const UpdateSectionEnrollmentSchema = z.object({
  id: IdSchema,
  sectionId: IdSchema,
  role: SectionEnrollmentRoleSchema,
  isActive: z.boolean(),
});

export const RemoveSectionEnrollmentSchema = z.object({
  sectionId: IdSchema,
  userId: z.string().trim().min(1),
});

export const ListSectionEnrollmentsSchema = z.object({
  sectionId: IdSchema,
  page: PageSchema,
  limit: LimitSchema,
  role: SectionEnrollmentRoleSchema.or(z.literal('')).optional().default(''),
  isActive: z.boolean().optional(),
});

export const listAcademicTerms = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListAcademicTermsSchema)
  .handler(async ({ data }) => {
    const { listAcademicTermsHandler } = await import('./academic-context.server');
    return listAcademicTermsHandler({ data });
  });

export const getAcademicTerm = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(AcademicTermIdSchema)
  .handler(async ({ data }) => {
    const { getAcademicTermHandler } = await import('./academic-context.server');
    return getAcademicTermHandler({ data });
  });

export const createAcademicTerm = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CreateAcademicTermSchema)
  .handler(async ({ data }) => {
    const { createAcademicTermHandler } = await import('./academic-context.server');
    return createAcademicTermHandler({ data });
  });

export const updateAcademicTerm = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UpdateAcademicTermSchema)
  .handler(async ({ data }) => {
    const { updateAcademicTermHandler } = await import('./academic-context.server');
    return updateAcademicTermHandler({ data });
  });

export const archiveAcademicTerm = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(AcademicTermIdSchema)
  .handler(async ({ data }) => {
    const { archiveAcademicTermHandler } = await import('./academic-context.server');
    return archiveAcademicTermHandler({ data });
  });

export const listCourses = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListCoursesSchema)
  .handler(async ({ data }) => {
    const { listCoursesHandler } = await import('./academic-context.server');
    return listCoursesHandler({ data });
  });

export const getCourse = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(CourseIdSchema)
  .handler(async ({ data }) => {
    const { getCourseHandler } = await import('./academic-context.server');
    return getCourseHandler({ data });
  });

export const createCourse = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CreateCourseSchema)
  .handler(async ({ data }) => {
    const { createCourseHandler } = await import('./academic-context.server');
    return createCourseHandler({ data });
  });

export const updateCourse = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UpdateCourseSchema)
  .handler(async ({ data }) => {
    const { updateCourseHandler } = await import('./academic-context.server');
    return updateCourseHandler({ data });
  });

export const archiveCourse = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CourseIdSchema)
  .handler(async ({ data }) => {
    const { archiveCourseHandler } = await import('./academic-context.server');
    return archiveCourseHandler({ data });
  });

export const listCourseSections = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListCourseSectionsSchema)
  .handler(async ({ data }) => {
    const { listCourseSectionsHandler } = await import('./academic-context.server');
    return listCourseSectionsHandler({ data });
  });

export const getCourseSection = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(CourseSectionIdSchema)
  .handler(async ({ data }) => {
    const { getCourseSectionHandler } = await import('./academic-context.server');
    return getCourseSectionHandler({ data });
  });

export const createCourseSection = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CreateCourseSectionSchema)
  .handler(async ({ data }) => {
    const { createCourseSectionHandler } = await import('./academic-context.server');
    return createCourseSectionHandler({ data });
  });

export const updateCourseSection = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UpdateCourseSectionSchema)
  .handler(async ({ data }) => {
    const { updateCourseSectionHandler } = await import('./academic-context.server');
    return updateCourseSectionHandler({ data });
  });

export const archiveCourseSection = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CourseSectionIdSchema)
  .handler(async ({ data }) => {
    const { archiveCourseSectionHandler } = await import('./academic-context.server');
    return archiveCourseSectionHandler({ data });
  });

export const listSectionEnrollments = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListSectionEnrollmentsSchema)
  .handler(async ({ data }) => {
    const { listSectionEnrollmentsHandler } = await import('./academic-context.server');
    return listSectionEnrollmentsHandler({ data });
  });

export const addSectionEnrollment = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(AddSectionEnrollmentSchema)
  .handler(async ({ data }) => {
    const { addSectionEnrollmentHandler } = await import('./academic-context.server');
    return addSectionEnrollmentHandler({ data });
  });

export const updateSectionEnrollment = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UpdateSectionEnrollmentSchema)
  .handler(async ({ data }) => {
    const { updateSectionEnrollmentHandler } = await import('./academic-context.server');
    return updateSectionEnrollmentHandler({ data });
  });

export const removeSectionEnrollment = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(RemoveSectionEnrollmentSchema)
  .handler(async ({ data }) => {
    const { removeSectionEnrollmentHandler } = await import('./academic-context.server');
    return removeSectionEnrollmentHandler({ data });
  });

export type CreateAcademicTermInput = z.infer<typeof CreateAcademicTermSchema>;
export type UpdateAcademicTermInput = z.infer<typeof UpdateAcademicTermSchema>;
export type ListAcademicTermsInput = z.infer<typeof ListAcademicTermsSchema>;
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;
export type ListCoursesInput = z.infer<typeof ListCoursesSchema>;
export type CreateCourseSectionInput = z.infer<typeof CreateCourseSectionSchema>;
export type UpdateCourseSectionInput = z.infer<typeof UpdateCourseSectionSchema>;
export type ListCourseSectionsInput = z.infer<typeof ListCourseSectionsSchema>;
export type AddSectionEnrollmentInput = z.infer<typeof AddSectionEnrollmentSchema>;
export type UpdateSectionEnrollmentInput = z.infer<typeof UpdateSectionEnrollmentSchema>;
export type RemoveSectionEnrollmentInput = z.infer<typeof RemoveSectionEnrollmentSchema>;
export type ListSectionEnrollmentsInput = z.infer<typeof ListSectionEnrollmentsSchema>;
