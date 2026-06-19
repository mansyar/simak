import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { listUsers, deleteUser, generateSetupLink, createUser, updateUser } from '@/server/users';
import { UserTable } from '@/components/admin/users/UserTable';
import { UserFilters } from '@/components/admin/users/UserFilters';
import { CreateUserDialog } from '@/components/admin/users/CreateUserDialog';
import { EditUserSheet } from '@/components/admin/users/EditUserSheet';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCcw } from 'lucide-react';
import { z } from 'zod';
import { useI18n } from '../../../__root';
const UserSearchSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
  search: z.string().optional().default(''),
  role: z.enum(['superadmin', 'admin', 'instructor', 'student']).optional(),
});
export const Route = createFileRoute('/_authenticated/admin/users/')({
  validateSearch: (search) => UserSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    page: search.page,
    limit: search.limit,
    search: search.search,
    role: search.role,
  }),
  loader: async ({ deps }) => {
    // Static import is safe - users.ts only has createServerFn stubs + Zod schemas (no server-only deps)
    // @ts-expect-error - listUsers handler type inference limitation
    return listUsers({ data: deps });
  },
  component: UsersPage,
});
function UsersPage() {
  const { t } = useI18n();
  const { users, total } = Route.useLoaderData();
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const deleteUserFn = useServerFn(deleteUser);
  const generateSetupLinkFn = useServerFn(generateSetupLink);
  const createUserFn = useServerFn(createUser);
  const updateUserFn = useServerFn(updateUser);
  const handleSearchChange = (value) => {
    navigate({
      search: (prev) => ({ ...prev, search: value, page: 1 }),
    });
  };
  const handleRoleChange = (value) => {
    navigate({
      search: (prev) => ({
        ...prev,
        role: value === 'all' ? undefined : value,
        page: 1,
      }),
    });
  };
  const handleEdit = (user) => {
    setEditingUser(user);
    setIsEditSheetOpen(true);
  };
  const handleDelete = async (user) => {
    if (confirm(t('adminUsers.deleteConfirm', { name: user.name }))) {
      // @ts-expect-error - useServerFn type inference limitation
      await deleteUserFn({ data: { id: user.id } });
      navigate({ search: (prev) => prev }); // Refresh
    }
  };
  const handleGenerateLink = async (user) => {
    // @ts-expect-error - useServerFn type inference limitation
    const result = await generateSetupLinkFn({ data: { id: user.id } });
    if ('url' in result) {
      alert(`Setup Link: ${result.url}`);
    } else {
      alert(`Error: ${result.error}`);
    }
  };
  const handleCreateUser = async (values) => {
    // @ts-expect-error - useServerFn type inference limitation
    const result = await createUserFn({ data: values });
    if (result.error) {
      alert(`${t('common.error')}: ${result.error}`);
    } else {
      navigate({ search: (prev) => prev }); // Refresh
    }
  };
  const handleUpdateUser = async (id, values) => {
    // @ts-expect-error - useServerFn type inference limitation
    const result = await updateUserFn({ data: { ...values, id } });
    if (result.error) {
      alert(`${t('common.error')}: ${result.error}`);
    } else {
      navigate({ search: (prev) => prev }); // Refresh
    }
  };
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex items-center justify-between',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h1', { className: 'font-display text-4xl', children: t('adminUsers.title') }),
              _jsx('p', { className: 'text-muted-foreground', children: t('adminUsers.subtitle') }),
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
                children: [_jsx(Plus, { className: 'mr-2 h-4 w-4' }), t('adminUsers.newUser')],
              }),
            ],
          }),
        ],
      }),
      _jsx(CreateUserDialog, {
        open: isCreateDialogOpen,
        onOpenChange: setIsCreateDialogOpen,
        onSubmit: handleCreateUser,
      }),
      _jsx(EditUserSheet, {
        user: editingUser,
        open: isEditSheetOpen,
        onOpenChange: setIsEditSheetOpen,
        onSubmit: handleUpdateUser,
      }),
      _jsx(UserFilters, {
        search: searchParams.search,
        onSearchChange: handleSearchChange,
        role: searchParams.role || 'all',
        onRoleChange: handleRoleChange,
      }),
      _jsx(UserTable, {
        data: users,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onGenerateLink: handleGenerateLink,
      }),
      _jsxs('div', {
        className: 'flex items-center justify-between',
        children: [
          _jsx('p', {
            className: 'text-sm text-muted-foreground',
            children: t('adminUsers.showing', {
              count: String(users.length),
              total: String(total),
            }),
          }),
          _jsxs('div', {
            className: 'flex items-center gap-2',
            children: [
              _jsx(Button, {
                variant: 'outline',
                size: 'sm',
                onClick: () =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      page: Math.max(1, (prev.page || 1) - 1),
                    }),
                  }),
                disabled: searchParams.page <= 1,
                children: t('common.back'),
              }),
              _jsx(Button, {
                variant: 'outline',
                size: 'sm',
                onClick: () =>
                  navigate({
                    search: (prev) => ({ ...prev, page: (prev.page || 1) + 1 }),
                  }),
                disabled: searchParams.page * searchParams.limit >= total,
                children: t('common.next'),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
