import { createFileRoute } from '@tanstack/react-router';
import { getTemplate, listTemplateAssignments, type GetTemplateResult, type TemplateAssignment } from '@/server/templates';
import { TemplateDetailPage } from '@/components/admin/templates/TemplateDetailPage';
import { TemplateDetailSkeleton } from '@/components/admin/templates/TemplateDetailSkeleton';
import { TemplateNotFound } from '@/components/admin/templates/TemplateNotFound';

interface TemplateRouteData {
  template: GetTemplateResult;
  assignments: TemplateAssignment[];
}

export const Route = createFileRoute('/_authenticated/admin/templates/$templateId')({
  loader: async ({ params }): Promise<TemplateRouteData> => {
    const templateId = Number(params.templateId);
    const template = await getTemplate({ data: { id: templateId } });
    const assignmentsResult = await listTemplateAssignments({ data: { templateId } });
    return { template, assignments: assignmentsResult?.assignments ?? [] };
  },
  pendingComponent: () => <TemplateDetailSkeleton />,
  notFoundComponent: () => <TemplateNotFound />,
  component: TemplateDetailRoute,
});

function TemplateDetailRoute() {
  const data = Route.useLoaderData();
  if (!data.template) {
    return <TemplateNotFound />;
  }
  return <TemplateDetailPage template={data.template} assignments={data.assignments} />;
}
