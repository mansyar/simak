import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  addSectionEnrollment,
  archiveAcademicTerm,
  archiveCourse,
  archiveCourseSection,
  createAcademicTerm,
  createCourse,
  createCourseSection,
  listAcademicTerms,
  listCourseSections,
  listCourses,
  listSectionEnrollments,
} from '@/server/academic-context';
import {
  AcademicContextPage,
  type AcademicArchiveTarget,
  type AcademicTermRow,
  type CourseRow,
  type CourseSectionRow,
  type SectionEnrollmentRow,
} from '@/components/admin/academic-context/AcademicContextPage';
import { isServerError, type ErrorCode } from '@/lib/errors';

export const Route = createFileRoute('/_authenticated/admin/academic-context')({
  loader: async () => {
    const [termResult, courseResult, sectionResult] = await Promise.all([
      listAcademicTerms({ data: { page: 1, limit: 100, search: '', status: '' } }),
      listCourses({ data: { page: 1, limit: 100, search: '' } }),
      listCourseSections({ data: { page: 1, limit: 100, search: '', status: '' } }),
    ]);

    const sections = getRows<CourseSectionRow>(sectionResult, 'sections');
    const enrollmentResults = await Promise.all(
      sections.map((section) =>
        listSectionEnrollments({
          data: { sectionId: section.id, page: 1, limit: 100, role: '' },
        }),
      ),
    );

    return {
      terms: getRows<AcademicTermRow>(termResult, 'terms'),
      courses: getRows<CourseRow>(courseResult, 'courses'),
      sections,
      enrollments: enrollmentResults.flatMap((result) =>
        getRows<SectionEnrollmentRow>(result, 'enrollments'),
      ),
      error: getError(termResult) ?? getError(courseResult) ?? getError(sectionResult),
    };
  },
  component: AcademicContextRoute,
});

function AcademicContextRoute() {
  const data = Route.useLoaderData();
  const router = useRouter();

  const refresh = async () => {
    await router.invalidate();
  };

  return (
    <AcademicContextPage
      {...data}
      loading={false}
      onCreateTerm={async (input) => {
        await createAcademicTerm({
          data: {
            ...input,
            status: 'draft',
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
          },
        });
        await refresh();
      }}
      onCreateCourse={async (input) => {
        await createCourse({ data: input });
        await refresh();
      }}
      onCreateSection={async (input) => {
        await createCourseSection({
          data: { ...input, status: 'active', name: input.name || null },
        });
        await refresh();
      }}
      onAddEnrollment={async (input) => {
        await addSectionEnrollment({ data: { ...input, isActive: true } });
        await refresh();
      }}
      onArchive={async (target) => {
        await archiveTarget(target);
        await refresh();
      }}
    />
  );
}

async function archiveTarget(target: AcademicArchiveTarget) {
  if (target.type === 'term') return archiveAcademicTerm({ data: { id: target.id } });
  if (target.type === 'course') return archiveCourse({ data: { id: target.id } });
  return archiveCourseSection({ data: { id: target.id } });
}

function getRows<T>(result: unknown, key: string): T[] {
  if (isServerError(result) || !result || typeof result !== 'object') return [];
  const rows = (result as Record<string, unknown>)[key];
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function getError(result: unknown): { code: ErrorCode; message: string } | null {
  return isServerError(result) ? { code: result.error.code, message: result.error.message } : null;
}
