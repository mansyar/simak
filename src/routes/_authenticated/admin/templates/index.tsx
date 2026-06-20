import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  listTemplates,
  createTemplate,
  getTemplate,
  deleteTemplate,
  duplicateTemplate,
  CreateTemplateSchema,
  type GetTemplateResult,
  type DeleteTemplateResult,
  type DuplicateTemplateResult,
} from '@/server/templates';
import { TemplateCard, TemplateRow } from '@/components/admin/templates/TemplateCard';
import { TemplateFilters } from '@/components/admin/templates/TemplateFilters';
import { Pagination } from '@/components/ui/pagination';
import { TemplateEmptyState } from '@/components/admin/templates/TemplateEmptyState';
import { TemplateLoadingSkeleton } from '@/components/admin/templates/TemplateLoadingSkeleton';
import { CreateTemplateDialog } from '@/components/admin/templates/CreateTemplateDialog';
import { DeleteTemplateDialog } from '@/components/admin/templates/DeleteTemplateDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { z } from 'zod';
import { useI18n } from '../../../__root';

const TemplateSearchSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
  search: z.string().optional().default(''),
  type: z.string().optional().default(''),
});

export const Route = createFileRoute('/_authenticated/admin/templates/')({
  validateSearch: (search) => TemplateSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    page: search.page,
    limit: search.limit,
    search: search.search,
    type: search.type,
  }),
  loader: async ({ deps }) => {
    return listTemplates({ data: deps });
  },
  pendingComponent: () => <TemplateLoadingSkeleton />,
  component: TemplatesPage,
});

function TemplatesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const data = Route.useLoaderData();
  const templates: TemplateRow[] = data?.templates ?? [];
  const total = data?.total ?? 0;
  const allTypes: string[] = data?.allTypes ?? [];
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<{
    id: number;
    usageCount: number;
  } | null>(null);

  const deleteTemplateFn = useServerFn(deleteTemplate);
  const duplicateTemplateFn = useServerFn(duplicateTemplate);
  const createTemplateFn = useServerFn(createTemplate);
  const getTemplateFn = useServerFn(getTemplate);

  type TemplateSearchParams = z.infer<typeof TemplateSearchSchema>;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await router.invalidate();
    setIsRefreshing(false);
  };

  const handleSearchChange = (value: string) => {
    navigate({
      search: (prev: TemplateSearchParams) => ({ ...prev, search: value, page: 1 }),
    });
  };

  const handleTypeChange = (value: string) => {
    navigate({
      search: (prev: TemplateSearchParams) => ({
        ...prev,
        type: value === 'all' ? '' : value,
        page: 1,
      }),
    });
  };

  const handlePageChange = (page: number) => {
    navigate({
      search: (prev: TemplateSearchParams) => ({ ...prev, page }),
    });
  };

  const handleCreateTemplate = async (values: z.infer<typeof CreateTemplateSchema>) => {
    const result = await createTemplateFn({ data: values });
    return result;
  };

  const handleCreateSuccess = (templateId?: number) => {
    if (templateId) {
      navigate({ to: `/admin/templates/$templateId`, params: { templateId: String(templateId) } });
    } else {
      navigate({ search: (prev: TemplateSearchParams) => prev }); // Refresh
    }
  };

  const handleEdit = (template: TemplateRow) => {
    navigate({ to: `/admin/templates/$templateId`, params: { templateId: String(template.id) } });
  };

  const handleDelete = async (template: TemplateRow) => {
    // First check if template is in use
    const fullTemplate = (await getTemplateFn({ data: { id: template.id } })) as GetTemplateResult;
    const usageCount = fullTemplate?.assignmentCount ?? 0;
    setDeletingTemplate({ id: template.id, usageCount });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTemplate) return;
    const result = (await deleteTemplateFn({ data: { id: deletingTemplate.id } })) as DeleteTemplateResult;
    if ('success' in result || ('error' in result && result.error === 'in_use')) {
      navigate({ search: (prev: TemplateSearchParams) => prev }); // Refresh
    }
  };

  const handleDuplicate = async (template: TemplateRow) => {
    const result = (await duplicateTemplateFn({ data: { id: template.id } })) as DuplicateTemplateResult;
    if ('template' in result && result.template) {
      navigate({ search: (prev: TemplateSearchParams) => prev }); // Refresh
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminTemplates.title')}
        subtitle={t('adminTemplates.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <RefreshButton isRefreshing={isRefreshing} onClick={handleRefresh} />
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('adminTemplates.newTemplate')}
            </Button>
          </div>
        }
      />

      <CreateTemplateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateTemplate}
        onSuccess={handleCreateSuccess}
      />

      <DeleteTemplateDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        usageCount={deletingTemplate?.usageCount ?? 0}
      />

      <TemplateFilters
        search={searchParams.search}
        onSearchChange={handleSearchChange}
        type={searchParams.type || 'all'}
        types={allTypes}
        onTypeChange={handleTypeChange}
      />

      {templates.length === 0 ? (
        <TemplateEmptyState onCreateNew={() => setIsCreateDialogOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {templates.length > 0 && (
        <Pagination
          currentPage={searchParams.page}
          totalPages={Math.max(1, Math.ceil(total / searchParams.limit))}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
