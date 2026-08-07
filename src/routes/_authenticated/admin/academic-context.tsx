import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  addSectionEnrollment,
  archiveAcademicTerm,
  archiveCourse,
  archiveCourseSection,
  createAcademicTerm,
  createCourse,
  createCourseSection,
  removeSectionEnrollment,
  updateAcademicTerm,
  updateCourse,
  updateCourseSection,
  updateSectionEnrollment,
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
import { academicContextKeys } from '@/lib/query-keys';

export const Route = createFileRoute('/_authenticated/admin/academic-context')({
  loader: loadAcademicContext,
  component: AcademicContextRoute,
});

async function loadAcademicContext() {
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
  const enrollmentError = enrollmentResults.map(getError).find((error) => error !== null) ?? null;

  return {
    terms: getTermRows(termResult),
    courses: getRows<CourseRow>(courseResult, 'courses'),
    sections,
    enrollments: enrollmentResults.flatMap((result) =>
      getRows<SectionEnrollmentRow>(result, 'enrollments'),
    ),
    error:
      getError(termResult) ?? getError(courseResult) ?? getError(sectionResult) ?? enrollmentError,
  };
}

function AcademicContextRoute() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<{ code: ErrorCode; message: string } | null>(
    null,
  );
  const contextQuery = useQuery({
    queryKey: academicContextKeys.all(),
    queryFn: loadAcademicContext,
    initialData: data,
    staleTime: 30_000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: academicContextKeys.all() });
    await router.invalidate();
  };

  const runMutation = async (operation: () => Promise<unknown>) => {
    try {
      const result = await operation();
      if (isServerError(result)) {
        setMutationError({ code: result.error.code, message: result.error.message });
        return;
      }
      setMutationError(null);
      await refresh();
    } catch {
      setMutationError({ code: 'INTERNAL', message: 'Internal Server Error' });
    }
  };

  return (
    <AcademicContextPage
      {...contextQuery.data}
      error={mutationError ?? contextQuery.data.error}
      loading={contextQuery.isLoading}
      onCreateTerm={async (input) => {
        await runMutation(() =>
          createAcademicTerm({
            data: {
              ...input,
              status: 'draft',
              startDate: new Date(input.startDate),
              endDate: new Date(input.endDate),
            },
          }),
        );
      }}
      onCreateCourse={async (input) => {
        await runMutation(() => createCourse({ data: input }));
      }}
      onCreateSection={async (input) => {
        await runMutation(() =>
          createCourseSection({
            data: { ...input, status: 'active', name: input.name || null },
          }),
        );
      }}
      onAddEnrollment={async (input) => {
        await runMutation(() => addSectionEnrollment({ data: { ...input, isActive: true } }));
      }}
      onUpdateTerm={async (input) => {
        await runMutation(() =>
          updateAcademicTerm({
            data: {
              ...input,
              startDate: new Date(input.startDate),
              endDate: new Date(input.endDate),
            },
          }),
        );
      }}
      onUpdateCourse={async (input) => {
        await runMutation(() => updateCourse({ data: input }));
      }}
      onUpdateSection={async (input) => {
        await runMutation(() =>
          updateCourseSection({ data: { ...input, name: input.name || null } }),
        );
      }}
      onUpdateEnrollment={async (input) => {
        await runMutation(() => updateSectionEnrollment({ data: input }));
      }}
      onRemoveEnrollment={async (input) => {
        await runMutation(() => removeSectionEnrollment({ data: input }));
      }}
      onArchive={async (target) => {
        await runMutation(() => archiveTarget(target));
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

type AcademicTermResultRow = Omit<AcademicTermRow, 'startsOn' | 'endsOn'> & {
  startsOn?: string;
  endsOn?: string;
  startDate?: string;
  endDate?: string;
};

function getTermRows(result: unknown): AcademicTermRow[] {
  return getRows<AcademicTermResultRow>(result, 'terms').map(
    ({ startsOn, endsOn, startDate, endDate, ...term }) => ({
      ...term,
      startsOn: startsOn ?? startDate ?? '',
      endsOn: endsOn ?? endDate ?? '',
    }),
  );
}

function getError(result: unknown): { code: ErrorCode; message: string } | null {
  return isServerError(result) ? { code: result.error.code, message: result.error.message } : null;
}
