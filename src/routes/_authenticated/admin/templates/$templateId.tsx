import { createFileRoute } from '@tanstack/react-router';
import { getTemplate } from '@/server/templates';
import { TemplateDetailPage } from '@/components/admin/templates/TemplateDetailPage';
import { TemplateDetailSkeleton } from '@/components/admin/templates/TemplateDetailSkeleton';
import { TemplateNotFound } from '@/components/admin/templates/TemplateNotFound';

export const Route = createFileRoute('/_authenticated/admin/templates/$templateId')({
  loader: async ({ params }) => {
    // @ts-expect-error - handler type inference limitation
    return getTemplate({ data: { id: Number(params.templateId) } });
  },
  pendingComponent: () => <TemplateDetailSkeleton />,
  notFoundComponent: () => <TemplateNotFound />,
  component: TemplateDetailRoute,
});

function TemplateDetailRoute() {
  const data = Route.useLoaderData();
  return <TemplateDetailPage template={data} />;
}
