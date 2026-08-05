import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { InterventionFilters } from '@/components/instructor/interventions/InterventionFilters';
import { InterventionForm } from '@/components/instructor/interventions/InterventionForm';
import {
  InterventionList,
  type InterventionListItem,
} from '@/components/instructor/interventions/InterventionList';
import {
  createIntervention,
  getInterventionContext,
  listInterventions,
  updateIntervention,
} from '@/server/interventions';
import { useI18n } from '../../../__root';
import { toast } from 'sonner';
import { InterventionListSkeleton } from '@/components/instructor/interventions/InterventionListSkeleton';
import { getErrorTranslationKey, type ErrorCode } from '@/lib/errors';

const BooleanSearchSchema = z.preprocess(
  (value) => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean().default(false),
);

const InterventionSearchSchema = z.object({
  status: z.enum(['open', 'monitoring', 'resolved', 'dismissed']).optional(),
  overdue: BooleanSearchSchema,
  assignmentId: z.coerce.number().int().positive().optional(),
  studentId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const Route = createFileRoute('/_authenticated/instructor/interventions/')({
  validateSearch: (search) => InterventionSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    status: search.status,
    overdue: search.overdue,
    assignmentId: search.assignmentId,
    studentId: search.studentId,
    page: search.page,
    limit: search.limit,
  }),
  loader: async ({ deps }) => {
    const list = await listInterventions({ data: deps });
    const contextResult =
      deps.assignmentId && deps.studentId
        ? await getInterventionContext({
            data: { assignmentId: deps.assignmentId, studentId: deps.studentId },
          })
        : null;

    return {
      list,
      context: contextResult && 'context' in contextResult ? contextResult.context : null,
    };
  },
  pendingComponent: () => <InterventionListSkeleton />,
  component: InstructorInterventionsPage,
});

function isError(value: unknown): value is { error: { code: ErrorCode; message: string } } {
  return typeof value === 'object' && value !== null && 'error' in value;
}

function InstructorInterventionsPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData() as {
    list: unknown;
    context: Parameters<typeof InterventionForm>[0]['context'];
  };
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const list =
    !isError(data.list) && 'interventions' in (data.list as object)
      ? (data.list as { interventions: InterventionListItem[]; total?: number })
      : null;
  const interventions = (list?.interventions ?? []) as InterventionListItem[];
  const activeIntervention = interventions.find(
    (intervention) => intervention.status === 'open' || intervention.status === 'monitoring',
  );
  const hasContextSelection = Boolean(
    search.assignmentId && search.studentId && (data.context || activeIntervention),
  );

  const updateSearch = (changes: Record<string, unknown>) =>
    navigate({
      search: (previous) => ({ ...previous, ...changes, page: 1 }),
    });

  const handleManage = (intervention: InterventionListItem) => {
    updateSearch({ assignmentId: intervention.assignmentId, studentId: intervention.studentId });
  };

  const handleSave = async (values: Record<string, unknown>) => {
    const result = activeIntervention
      ? await updateIntervention({ data: values as never })
      : await createIntervention({ data: values as never });
    if (isError(result)) throw new Error(t('errors.fetchFailed'));

    toast.success(t('instructorInterventions.saveSuccess'));
    await navigate({
      search: (previous) => ({ ...previous, studentId: undefined, page: 1 }),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('instructorInterventions.title')}
        subtitle={t('instructorInterventions.subtitle')}
        action={
          hasContextSelection ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => updateSearch({ assignmentId: undefined, studentId: undefined })}
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              {t('instructorInterventions.closeForm')}
            </Button>
          ) : undefined
        }
      />

      <InterventionFilters
        status={search.status ?? null}
        overdue={search.overdue}
        onStatusChange={(status) => updateSearch({ status: status ?? undefined })}
        onOverdueChange={(overdue) => updateSearch({ overdue })}
      />

      {isError(data.list) ? (
        <ErrorState
          title={t(getErrorTranslationKey(data.list.error.code))}
          retryLabel={t('common.refresh')}
          onRetry={() => navigate({ search })}
        />
      ) : (
        <>
          {hasContextSelection && (
            <InterventionForm
              mode={activeIntervention ? 'edit' : 'create'}
              assignmentId={search.assignmentId!}
              studentId={search.studentId!}
              intervention={activeIntervention}
              context={data.context}
              onSubmit={handleSave}
              onCancel={() => updateSearch({ studentId: undefined })}
            />
          )}
          <InterventionList interventions={interventions} onManage={handleManage} />
          {interventions.length > 0 && (
            <Pagination
              currentPage={search.page}
              totalPages={Math.max(1, Math.ceil((list?.total ?? 0) / search.limit))}
              onPageChange={(page) => navigate({ search: (previous) => ({ ...previous, page }) })}
              showCounter
            />
          )}
        </>
      )}
    </div>
  );
}
