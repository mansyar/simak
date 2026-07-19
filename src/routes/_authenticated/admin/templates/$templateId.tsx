import { createFileRoute } from '@tanstack/react-router';
import {
  getTemplate,
  listTemplateAssignments,
  type GetTemplateResult,
  type TemplateAssignment,
} from '@/server/templates';
import { TemplateDetailPage } from '@/components/admin/templates/TemplateDetailPage';
import { TemplateDetailSkeleton } from '@/components/admin/templates/TemplateDetailSkeleton';
import { TemplateNotFound } from '@/components/admin/templates/TemplateNotFound';
import { isServerError } from '@/lib/errors';

interface TemplateRouteData {
  template: GetTemplateResult;
  assignments: TemplateAssignment[];
  assignmentsTotal: number;
}

export const Route = createFileRoute('/_authenticated/admin/templates/$templateId')({
  loader: async ({ params }): Promise<TemplateRouteData> => {
    const templateId = Number(params.templateId);
    const templateResult = await getTemplate({ data: { id: templateId } });
    const template = isServerError(templateResult) ? null : templateResult;
    const assignmentsResult = await listTemplateAssignments({
      data: { templateId, page: 1, limit: 20 },
    });
    const assignments = isServerError(assignmentsResult)
      ? []
      : (assignmentsResult?.assignments ?? []);
    const assignmentsTotal = isServerError(assignmentsResult) ? 0 : (assignmentsResult?.total ?? 0);
    return { template, assignments, assignmentsTotal };
  },
  pendingComponent: () => <TemplateDetailSkeleton />,
  notFoundComponent: () => <TemplateNotFound />,
  component: TemplateDetailRoute,
});

function TemplateDetailRoute() {
  const data = Route.useLoaderData();
  if (!data.template || isServerError(data.template)) {
    return <TemplateNotFound />;
  }
  return (
    <TemplateDetailPage
      template={data.template}
      assignments={data.assignments}
      assignmentsTotal={data.assignmentsTotal}
    />
  );
}
