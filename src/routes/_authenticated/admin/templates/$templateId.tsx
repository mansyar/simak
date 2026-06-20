import { createFileRoute } from '@tanstack/react-router';
import { getTemplate, listTemplateAssignments } from '@/server/templates';
import { TemplateDetailPage } from '@/components/admin/templates/TemplateDetailPage';
import { TemplateDetailSkeleton } from '@/components/admin/templates/TemplateDetailSkeleton';
import { TemplateNotFound } from '@/components/admin/templates/TemplateNotFound';

export const Route = createFileRoute('/_authenticated/admin/templates/$templateId')({
  loader: async ({ params }) => {
    const templateId = Number(params.templateId);
    // @ts-expect-error - handler type inference limitation
    const template = await getTemplate({ data: { id: templateId } });
    // @ts-expect-error - handler type inference limitation
    const assignmentsResult = await listTemplateAssignments({ data: { templateId } });
    return { ...template, assignments: assignmentsResult?.assignments ?? [] };
  },
  pendingComponent: () => <TemplateDetailSkeleton />,
  notFoundComponent: () => <TemplateNotFound />,
  component: TemplateDetailRoute,
});

function TemplateDetailRoute() {
  const data = Route.useLoaderData();
  return (
    <TemplateDetailPage
      template={data as any}
      assignments={data.assignments}
    />
  );
}
