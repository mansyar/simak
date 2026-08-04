import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  getTemplate,
  listTemplateAssignments,
  type GetTemplateResult,
  type TemplateAssignment,
} from '@/server/templates';
import { TemplateDetailPage } from '@/components/admin/templates/TemplateDetailPage';
import { TemplateDetailSkeleton } from '@/components/admin/templates/TemplateDetailSkeleton';
import { TemplateNotFound } from '@/components/admin/templates/TemplateNotFound';
import { ErrorCode, getErrorTranslationKey, isServerError, type ServerError } from '@/lib/errors';
import { ErrorState } from '@/components/ui/error-state';
import { useI18n } from '../../../__root';

interface TemplateRouteData {
  template: GetTemplateResult;
  assignments: TemplateAssignment[] | ServerError;
  assignmentsTotal: number;
}

export const Route = createFileRoute('/_authenticated/admin/templates/$templateId')({
  loader: async ({ params }): Promise<TemplateRouteData> => {
    const templateId = Number(params.templateId);
    const templateResult = await getTemplate({ data: { id: templateId } });
    const assignmentsResult = await listTemplateAssignments({
      data: { templateId, page: 1, limit: 20 },
    });
    if (isServerError(assignmentsResult)) {
      return { template: templateResult, assignments: assignmentsResult, assignmentsTotal: 0 };
    }

    return {
      template: templateResult,
      assignments: assignmentsResult?.assignments ?? [],
      assignmentsTotal: assignmentsResult?.total ?? 0,
    };
  },
  pendingComponent: () => <TemplateDetailSkeleton />,
  notFoundComponent: () => <TemplateNotFound />,
  component: TemplateDetailRoute,
});

function TemplateDetailRoute() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const router = useRouter();

  if (!data.template) {
    return <TemplateNotFound />;
  }

  if (isServerError(data.template)) {
    if (data.template.error.code === ErrorCode.NOT_FOUND) {
      return <TemplateNotFound />;
    }

    return (
      <ErrorState
        title={t(getErrorTranslationKey(data.template.error.code))}
        retryLabel={t('common.refresh')}
        onRetry={() => router.invalidate()}
      />
    );
  }

  if (isServerError(data.assignments)) {
    return (
      <ErrorState
        title={t(getErrorTranslationKey(data.assignments.error.code))}
        retryLabel={t('common.refresh')}
        onRetry={() => router.invalidate()}
      />
    );
  }

  return (
    <TemplateDetailPage
      template={data.template}
      assignments={data.assignments}
      assignmentsTotal={data.assignmentsTotal}
    />
  );
}
