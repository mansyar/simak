import { createFileRoute, useRouter } from '@tanstack/react-router';
import { z } from 'zod';
import { AcademicRecordsView } from '@/components/academic-records/AcademicRecordsView';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getInstructorAcademicRecords,
  type AcademicRecordsResult,
} from '@/server/academic-records';
import { isServerError } from '@/lib/errors';
import { listInstructorAssignmentSections } from '@/server/instructor-assignment-context';
import { useI18n } from '../../__root';

type InstructorAcademicRecordsLoaderData = {
  data: AcademicRecordsResult;
  sections: { id: number; label: string }[];
};

const AcademicRecordsSearchSchema = z.object({
  sectionId: z.coerce.number().int().positive().optional(),
  termId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const Route = createFileRoute('/_authenticated/instructor/academic-records')({
  validateSearch: (search) => AcademicRecordsSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    sectionId: search.sectionId,
    termId: search.termId,
    page: search.page,
    limit: search.limit,
  }),
  loader: async ({ deps }) => {
    const sectionResult = await listInstructorAssignmentSections();
    const sections = isServerError(sectionResult) ? [] : sectionResult.sections;
    const selectedSectionId = deps.sectionId ?? sections[0]?.id;
    const data = isServerError(sectionResult)
      ? sectionResult
      : selectedSectionId
        ? await getInstructorAcademicRecords({
            data: {
              sectionId: selectedSectionId,
              termId: deps.termId,
              page: deps.page,
              limit: deps.limit,
            },
          })
        : {
            error: { code: 'NOT_FOUND', message: 'No authorized sections available' },
          };

    return {
      data,
      sections: sections.map(({ id, label }) => ({ id, label })),
    };
  },
  pendingComponent: AcademicRecordsLoading,
  component: InstructorAcademicRecordsRoute,
});

function AcademicRecordsLoading() {
  const { t } = useI18n();
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-6"
      aria-busy="true"
      aria-label={t('academicRecords.title')}
    >
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function InstructorAcademicRecordsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { data, sections } = Route.useLoaderData() as InstructorAcademicRecordsLoaderData;
  const selectedSectionId = search.sectionId ?? sections[0]?.id;

  return (
    <AcademicRecordsView
      data={data}
      role="instructor"
      sections={sections}
      selectedSectionId={selectedSectionId}
      onSectionChange={(sectionId) =>
        navigate({ search: (previous) => ({ ...previous, sectionId, page: 1 }) })
      }
      terms={
        !('error' in data) ? data.terms.map((term) => ({ id: term.id, label: term.name })) : []
      }
      selectedTermId={search.termId}
      onTermChange={(termId) =>
        navigate({ search: (previous) => ({ ...previous, termId, page: 1 }) })
      }
      onPageChange={(page) => navigate({ search: (previous) => ({ ...previous, page }) })}
      onRetry={() => router.invalidate()}
    />
  );
}
