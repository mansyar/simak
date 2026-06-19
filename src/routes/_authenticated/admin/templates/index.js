import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  listTemplates,
  createTemplate,
  getTemplate,
  deleteTemplate,
  duplicateTemplate,
} from '@/server/templates';
import { TemplateCard } from '@/components/admin/templates/TemplateCard';
import { TemplateFilters } from '@/components/admin/templates/TemplateFilters';
import { TemplatePagination } from '@/components/admin/templates/TemplatePagination';
import { TemplateEmptyState } from '@/components/admin/templates/TemplateEmptyState';
import { TemplateLoadingSkeleton } from '@/components/admin/templates/TemplateLoadingSkeleton';
import { CreateTemplateDialog } from '@/components/admin/templates/CreateTemplateDialog';
import { DeleteTemplateDialog } from '@/components/admin/templates/DeleteTemplateDialog';
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
    // @ts-expect-error - listTemplates handler type inference limitation
    return listTemplates({ data: deps });
  },
  pendingComponent: () => _jsx(TemplateLoadingSkeleton, {}),
  component: TemplatesPage,
});
function TemplatesPage() {
  const { t } = useI18n();
  const data = Route.useLoaderData();
  const templates = data?.templates ?? [];
  const total = data?.total ?? 0;
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const deleteTemplateFn = useServerFn(deleteTemplate);
  const duplicateTemplateFn = useServerFn(duplicateTemplate);
  const createTemplateFn = useServerFn(createTemplate);
  const getTemplateFn = useServerFn(getTemplate);
  const handleSearchChange = (value) => {
    navigate({
      search: (prev) => ({ ...prev, search: value, page: 1 }),
    });
  };
  const handleTypeChange = (value) => {
    navigate({
      search: (prev) => ({
        ...prev,
        type: value === 'all' ? '' : value,
        page: 1,
      }),
    });
  };
  const handlePageChange = (page) => {
    navigate({
      search: (prev) => ({ ...prev, page }),
    });
  };
  const handleCreateTemplate = async (values) => {
    // @ts-expect-error - useServerFn type inference limitation
    const result = await createTemplateFn({ data: values });
    return result;
  };
  const handleCreateSuccess = (templateId) => {
    if (templateId) {
      navigate({ to: `/admin/templates/$templateId`, params: { templateId: String(templateId) } });
    } else {
      navigate({ search: (prev) => prev }); // Refresh
    }
  };
  const handleEdit = (template) => {
    navigate({ to: `/admin/templates/$templateId`, params: { templateId: String(template.id) } });
  };
  const handleDelete = async (template) => {
    // First check if template is in use
    // @ts-expect-error - useServerFn type inference limitation
    const fullTemplate = await getTemplateFn({ data: { id: template.id } });
    const usageCount = fullTemplate?.assignmentCount ?? 0;
    setDeletingTemplate({ id: template.id, usageCount });
    setIsDeleteDialogOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (!deletingTemplate) return;
    // @ts-expect-error - useServerFn type inference limitation
    const result = await deleteTemplateFn({ data: { id: deletingTemplate.id } });
    if (result.success || result.error === 'in_use') {
      navigate({ search: (prev) => prev }); // Refresh
    }
  };
  const handleDuplicate = async (template) => {
    // @ts-expect-error - useServerFn type inference limitation
    const result = await duplicateTemplateFn({ data: { id: template.id } });
    if (result.template) {
      navigate({ search: (prev) => prev }); // Refresh
    }
  };
  // Unique template types for filter dropdown
  const allTypes = [...new Set(templates.map((t) => t.type))];
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex items-center justify-between',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h1', {
                className: 'font-display text-4xl',
                children: t('adminTemplates.title'),
              }),
              _jsx('p', {
                className: 'text-muted-foreground',
                children: t('adminTemplates.subtitle'),
              }),
            ],
          }),
          _jsxs('div', {
            className: 'flex items-center gap-2',
            children: [
              _jsx(Button, {
                variant: 'outline',
                size: 'icon',
                onClick: () => {
                  setIsRefreshing(true);
                  navigate({ search: (prev) => prev });
                  setTimeout(() => setIsRefreshing(false), 1500);
                },
                disabled: isRefreshing,
                children: _jsx(RefreshCcw, {
                  className: `h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`,
                }),
              }),
              _jsxs(Button, {
                onClick: () => setIsCreateDialogOpen(true),
                children: [
                  _jsx(Plus, { className: 'mr-2 h-4 w-4' }),
                  t('adminTemplates.newTemplate'),
                ],
              }),
            ],
          }),
        ],
      }),
      _jsx(CreateTemplateDialog, {
        open: isCreateDialogOpen,
        onOpenChange: setIsCreateDialogOpen,
        onSubmit: handleCreateTemplate,
        onSuccess: handleCreateSuccess,
      }),
      _jsx(DeleteTemplateDialog, {
        open: isDeleteDialogOpen,
        onOpenChange: setIsDeleteDialogOpen,
        onConfirm: handleConfirmDelete,
        usageCount: deletingTemplate?.usageCount ?? 0,
      }),
      _jsx(TemplateFilters, {
        search: searchParams.search,
        onSearchChange: handleSearchChange,
        type: searchParams.type || 'all',
        types: allTypes,
        onTypeChange: handleTypeChange,
      }),
      templates.length === 0
        ? _jsx(TemplateEmptyState, { onCreateNew: () => setIsCreateDialogOpen(true) })
        : _jsx('div', {
            className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
            children: templates.map((template) =>
              _jsx(
                TemplateCard,
                {
                  template: template,
                  onEdit: handleEdit,
                  onDuplicate: handleDuplicate,
                  onDelete: handleDelete,
                },
                template.id,
              ),
            ),
          }),
      templates.length > 0 &&
        _jsx(TemplatePagination, {
          currentPage: searchParams.page,
          totalPages: Math.max(1, Math.ceil(total / searchParams.limit)),
          onPageChange: handlePageChange,
        }),
    ],
  });
}
