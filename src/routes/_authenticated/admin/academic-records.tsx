import { createFileRoute, useRouter } from '@tanstack/react-router';
import { z } from 'zod';
import { AcademicRecordsView } from '@/components/academic-records/AcademicRecordsView';
import { Skeleton } from '@/components/ui/skeleton';
import { getAdminAcademicRecords, type AcademicRecordsResult } from '@/server/academic-records';
import { useI18n } from '../../__root';

const AcademicRecordsSearchSchema = z.object({
  studentId: z.string().trim().min(1).optional(),
  sectionId: z.coerce.number().int().positive().optional(),
  status: z.enum(['complete', 'incomplete', 'withdrawn']).optional(),
  termId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const Route = createFileRoute('/_authenticated/admin/academic-records')({
  validateSearch: (search) => AcademicRecordsSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    studentId: search.studentId,
    sectionId: search.sectionId,
    status: search.status,
    termId: search.termId,
    page: search.page,
    limit: search.limit,
  }),
  loader: ({ deps }) => getAdminAcademicRecords({ data: deps }),
  pendingComponent: AcademicRecordsLoading,
  component: AdminAcademicRecordsRoute,
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

function AdminAcademicRecordsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const data = Route.useLoaderData() as AcademicRecordsResult;

  return (
    <AcademicRecordsView
      data={data}
      role="admin"
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
