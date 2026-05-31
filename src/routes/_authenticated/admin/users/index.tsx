import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { listUsers, deleteUser, generateSetupLink, createUser, updateUser } from '@/server/users';
import { UserTable, UserRow } from '@/components/admin/users/UserTable';
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
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  const deleteUserFn = useServerFn(deleteUser);
  const generateSetupLinkFn = useServerFn(generateSetupLink);
  const createUserFn = useServerFn(createUser);
  const updateUserFn = useServerFn(updateUser);

  type UserSearchParams = z.infer<typeof UserSearchSchema>;

  const handleSearchChange = (value: string) => {
    navigate({
      search: (prev: UserSearchParams) => ({ ...prev, search: value, page: 1 }),
    });
  };

  const handleRoleChange = (value: string) => {
    navigate({
      search: (prev: UserSearchParams) => ({
        ...prev,
        role:
          value === 'all'
            ? undefined
            : (value as 'superadmin' | 'admin' | 'instructor' | 'student'),
        page: 1,
      }),
    });
  };

  const handleEdit = (user: UserRow) => {
    setEditingUser(user);
    setIsEditSheetOpen(true);
  };

  const handleDelete = async (user: UserRow) => {
    if (confirm(t('adminUsers.deleteConfirm', { name: user.name }))) {
      // @ts-expect-error - useServerFn type inference limitation
      await deleteUserFn({ data: { id: user.id } });
      navigate({ search: (prev: UserSearchParams) => prev }); // Refresh
    }
  };

  const handleGenerateLink = async (user: UserRow) => {
    // @ts-expect-error - useServerFn type inference limitation
    const result = await generateSetupLinkFn({ data: { id: user.id } });
    if ('url' in result) {
      alert(`Setup Link: ${result.url}`);
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleCreateUser = async (values: Record<string, unknown>) => {
    // @ts-expect-error - useServerFn type inference limitation
    const result = await createUserFn({ data: values });
    if (result.error) {
      alert(`${t('common.error')}: ${result.error}`);
    } else {
      navigate({ search: (prev: UserSearchParams) => prev }); // Refresh
    }
  };

  const handleUpdateUser = async (id: string, values: Record<string, unknown>) => {
    // @ts-expect-error - useServerFn type inference limitation
    const result = await updateUserFn({ data: { ...values, id } });
    if (result.error) {
      alert(`${t('common.error')}: ${result.error}`);
    } else {
      navigate({ search: (prev: UserSearchParams) => prev }); // Refresh
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl">{t('adminUsers.title')}</h1>
          <p className="text-muted-foreground">{t('adminUsers.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsRefreshing(true);
              navigate({ search: (prev: UserSearchParams) => prev });
              setTimeout(() => setIsRefreshing(false), 1500);
            }}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('adminUsers.newUser')}
          </Button>
        </div>
      </div>

      <CreateUserDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateUser}
      />

      <EditUserSheet
        user={editingUser}
        open={isEditSheetOpen}
        onOpenChange={setIsEditSheetOpen}
        onSubmit={handleUpdateUser}
      />

      <UserFilters
        search={searchParams.search}
        onSearchChange={handleSearchChange}
        role={searchParams.role || 'all'}
        onRoleChange={handleRoleChange}
      />

      <UserTable
        data={users as UserRow[]}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onGenerateLink={handleGenerateLink}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {users.length} of {total} users
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({
                search: (prev: UserSearchParams) => ({
                  ...prev,
                  page: Math.max(1, (prev.page || 1) - 1),
                }),
              })
            }
            disabled={searchParams.page <= 1}
          >
            {t('common.back')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({
                search: (prev: UserSearchParams) => ({ ...prev, page: (prev.page || 1) + 1 }),
              })
            }
            disabled={searchParams.page * searchParams.limit >= total}
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
