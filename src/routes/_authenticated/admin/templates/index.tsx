import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  listTemplates,
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
} from '@/server/templates';
import { TemplateCard, TemplateRow } from '@/components/admin/templates/TemplateCard';
import { TemplateFilters } from '@/components/admin/templates/TemplateFilters';
import { TemplatePagination } from '@/components/admin/templates/TemplatePagination';
import { TemplateEmptyState } from '@/components/admin/templates/TemplateEmptyState';
import { TemplateLoadingSkeleton } from '@/components/admin/templates/TemplateLoadingSkeleton';
import { CreateTemplateDialog } from '@/components/admin/templates/CreateTemplateDialog';
import { EditTemplateSheet } from '@/components/admin/templates/EditTemplateSheet';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCcw } from 'lucide-react';
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
  const data = Route.useLoaderData();
  const templates: TemplateRow[] = data?.templates ?? [];
  const total = data?.total ?? 0;
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const deleteTemplateFn = useServerFn(deleteTemplate);
  const duplicateTemplateFn = useServerFn(duplicateTemplate);
  const createTemplateFn = useServerFn(createTemplate);
  const getTemplateFn = useServerFn(getTemplate);
  const updateTemplateFn = useServerFn(updateTemplate);

  const handleSearchChange = (value: string) => {
    navigate({
      search: (prev) => ({ ...prev, search: value, page: 1 }),
    });
  };

  const handleTypeChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        type: value === 'all' ? '' : value,
        page: 1,
      }),
    });
  };

  const handlePageChange = (page: number) => {
    navigate({
      search: (prev) => ({ ...prev, page }),
    });
  };

  const handleCreateTemplate = async (values: Record<string, unknown>) => {
    const result = await (createTemplateFn as any)({ data: values });
    return result;
  };

  const handleCreateSuccess = () => {
    navigate({ search: (prev) => prev }); // Refresh
  };

  const handleEdit = async (template: TemplateRow) => {
    const result = await (getTemplateFn as any)({ data: { id: template.id } });
    if (result) {
      setEditingTemplate(result);
      setIsEditSheetOpen(true);
    }
  };

  const handleUpdateTemplate = async (id: number, values: Record<string, unknown>) => {
    const result = await (updateTemplateFn as any)({ data: { ...values, id } });
    return result;
  };

  const handleEditSuccess = () => {
    navigate({ search: (prev) => prev }); // Refresh
  };

  const handleDelete = async (template: TemplateRow) => {
    if (confirm(t('adminTemplates.deleteConfirm'))) {
      await (deleteTemplateFn as any)({ data: { id: template.id } });
      navigate({ search: (prev) => prev });
    }
  };

  const handleDuplicate = async (template: TemplateRow) => {
    const result = await (duplicateTemplateFn as any)({ data: { id: template.id } });
    if (result.template) {
      navigate({ search: (prev) => prev }); // Refresh
    }
  };

  // Unique template types for filter dropdown
  const allTypes = [...new Set(templates.map((t) => t.type))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('adminTemplates.title')}</h1>
          <p className="text-muted-foreground">
            Manage assignment templates and checkpoint structures.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsRefreshing(true);
              navigate({ search: (prev) => prev });
              setTimeout(() => setIsRefreshing(false), 1500);
            }}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('adminTemplates.newTemplate')}
          </Button>
        </div>
      </div>

      <CreateTemplateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateTemplate}
        onSuccess={handleCreateSuccess}
      />

      <EditTemplateSheet
        template={editingTemplate}
        open={isEditSheetOpen}
        onOpenChange={setIsEditSheetOpen}
        onSubmit={handleUpdateTemplate}
        onSuccess={handleEditSuccess}
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
        <TemplatePagination
          currentPage={searchParams.page}
          totalPages={Math.max(1, Math.ceil(total / searchParams.limit))}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
