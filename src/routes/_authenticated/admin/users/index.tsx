import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listUsers,
  deleteUser,
  generateSetupLink,
  createUser,
  updateUser,
  listInstructorActiveAssignments,
  CreateUserSchema,
  UpdateUserSchema,
} from '@/server/users';
import { reassignAssignment } from '@/server/assignments';
import { UserTable, UserRow } from '@/components/admin/users/UserTable';
import { UserFilters } from '@/components/admin/users/UserFilters';
import { CreateUserDialog } from '@/components/admin/users/CreateUserDialog';
import { EditUserSheet } from '@/components/admin/users/EditUserSheet';
import { DeleteUserDialog } from '@/components/admin/users/DeleteUserDialog';
import { ReassignmentDialog } from '@/components/admin/users/ReassignmentDialog';
import { SetupLinkSheet } from '@/components/admin/users/SetupLinkSheet';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Plus, Upload, Download } from 'lucide-react';
import { z } from 'zod';
import { useI18n } from '../../../__root';
import { isServerError, ErrorCode } from '@/lib/errors';
import { userKeys } from '@/lib/query-keys';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { exportUsersCsv } from '@/server/analytics';
import { useCsvDownload } from '@/hooks/use-csv-download';

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
    return listUsers({ data: deps });
  },
  component: UsersPage,
  pendingComponent: () => <TableSkeleton />,
});

function UsersPage() {
  const { t } = useI18n();
  const loaderData = Route.useLoaderData();
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { exportCsv, isExporting } = useCsvDownload();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [setupLinkUser, setSetupLinkUser] = useState<UserRow | null>(null);
  const [setupLinkUrl, setSetupLinkUrl] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [reassignmentUser, setReassignmentUser] = useState<UserRow | null>(null);
  const [reassignmentAssignments, setReassignmentAssignments] = useState<
    { id: number; title: string }[]
  >([]);
  const [reassignmentInstructors, setReassignmentInstructors] = useState<
    { id: string; name: string }[]
  >([]);

  const generateSetupLinkFn = useServerFn(generateSetupLink);
  const createUserFn = useServerFn(createUser);
  const updateUserFn = useServerFn(updateUser);
  const listInstructorActiveAssignmentsFn = useServerFn(listInstructorActiveAssignments);
  const reassignAssignmentFn = useServerFn(reassignAssignment);

  type UserSearchParams = z.infer<typeof UserSearchSchema>;

  const usersQuery = useQuery({
    queryKey: userKeys.list({
      page: searchParams.page,
      limit: searchParams.limit,
      search: searchParams.search,
      role: searchParams.role,
    }),
    queryFn: async () => {
      const result = await listUsers({
        data: {
          page: searchParams.page,
          limit: searchParams.limit,
          search: searchParams.search,
          role: searchParams.role,
        },
      });
      if (isServerError(result)) {
        throw new Error(result.error.message);
      }
      return result;
    },
    initialData: isServerError(loaderData) ? undefined : loaderData,
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });

  const { users, total } = usersQuery.data ?? { users: [], total: 0 };

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await deleteUser({ data: { id: userId } });
      if (isServerError(result)) {
        throw result;
      }
      return result;
    },
    onMutate: async (userId: string) => {
      await queryClient.cancelQueries({ queryKey: userKeys.all() });
      const previousEntries = queryClient.getQueriesData({ queryKey: userKeys.all() });
      queryClient.setQueriesData({ queryKey: userKeys.all() }, (old: unknown) => {
        if (old && typeof old === 'object' && 'users' in old) {
          const data = old as { users: { id: string }[]; total: number };
          return {
            users: data.users.filter((u) => u.id !== userId),
            total: Math.max(0, data.total - 1),
          };
        }
        return old;
      });
      return { previousEntries };
    },
    onError: (error, _variables, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, data] of context.previousEntries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (isServerError(error)) {
        toast.error(error.error.message);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all() });
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: userKeys.all() });
    setIsRefreshing(false);
  };

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

  const handleDelete = async (user: UserRow): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(user.id);
      return true; // deleted
    } catch (e) {
      if (isServerError(e) && e.error.code === ErrorCode.BAD_REQUEST) {
        const assignmentsResult = await listInstructorActiveAssignmentsFn({
          data: { instructorId: user.id },
        });
        const instructorsResult = await listUsers({
          data: { page: 1, limit: 100, search: '', role: 'instructor' },
        });
        const instructors = isServerError(instructorsResult)
          ? []
          : instructorsResult.users
              .filter((u) => u.id !== user.id)
              .map((u) => ({ id: u.id, name: u.name }));
        setReassignmentAssignments(
          isServerError(assignmentsResult) ? [] : assignmentsResult.assignments,
        );
        setReassignmentInstructors(instructors);
        setReassignmentUser(user);
        return false; // reassignment needed
      }
      // Other server errors — preserve existing behavior (refresh + return true)
      queryClient.invalidateQueries({ queryKey: userKeys.all() });
      return true;
    }
  };

  const handleGenerateLink = async (user: UserRow) => {
    const result = await generateSetupLinkFn({ data: { id: user.id } });
    if (isServerError(result)) {
      setInlineError(result.error.message);
    } else {
      setSetupLinkUrl(result.url ?? '');
      setSetupLinkUser(user);
    }
  };

  const handleCreateUser = async (values: z.infer<typeof CreateUserSchema>) => {
    const result = await createUserFn({ data: values });
    if (isServerError(result)) {
      setInlineError(`${t('common.error')}: ${result.error.message}`);
      throw new Error(result.error.message);
    }
    queryClient.invalidateQueries({ queryKey: userKeys.all() });
  };

  const handleUpdateUser = async (id: string, values: z.infer<typeof UpdateUserSchema>) => {
    const result = await updateUserFn({ data: { ...values, id } });
    if (isServerError(result)) {
      setInlineError(`${t('common.error')}: ${result.error.message}`);
      throw new Error(result.error.message);
    }
    queryClient.invalidateQueries({ queryKey: userKeys.all() });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminUsers.title')}
        subtitle={t('adminUsers.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <RefreshButton isRefreshing={isRefreshing} onClick={handleRefresh} />
            <Button
              variant="outline"
              loading={isExporting}
              onClick={() =>
                exportCsv(() => exportUsersCsv({ data: {} }) as Promise<unknown>, 'users.csv')
              }
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('common.exportCsv')}
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: '/admin/users/import' })}>
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('bulkImport.users.button')}
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('adminUsers.newUser')}
            </Button>
          </div>
        }
      />

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
        onDelete={(user) => setDeletingUser(user)}
        onGenerateLink={handleGenerateLink}
      />

      <DeleteUserDialog
        open={deletingUser !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null);
        }}
        onConfirm={async () => {
          if (deletingUser) {
            const deleted = await handleDelete(deletingUser);
            if (!deleted) {
              throw new Error('Reassignment needed');
            }
            setDeletingUser(null);
          }
        }}
        userName={deletingUser?.name ?? ''}
      />

      <ReassignmentDialog
        open={reassignmentUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReassignmentUser(null);
            setReassignmentAssignments([]);
            setReassignmentInstructors([]);
          }
        }}
        assignments={reassignmentAssignments}
        instructors={reassignmentInstructors}
        onReassign={async (assignmentId, newInstructorId) => {
          await reassignAssignmentFn({ data: { assignmentId, newInstructorId } });
        }}
        onDelete={async () => {
          if (reassignmentUser) {
            try {
              await deleteMutation.mutateAsync(reassignmentUser.id);
              setReassignmentUser(null);
            } catch (e) {
              if (isServerError(e)) {
                setInlineError(e.error.message);
              }
            }
          }
        }}
      />

      <SetupLinkSheet
        open={setupLinkUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSetupLinkUser(null);
            setSetupLinkUrl('');
          }
        }}
        url={setupLinkUrl}
      />

      {inlineError && <AlertBanner variant="error" title={inlineError} />}

      {users.length > 0 && (
        <Pagination
          currentPage={searchParams.page || 1}
          totalPages={Math.ceil(total / searchParams.limit)}
          onPageChange={(page) =>
            navigate({ search: (prev: UserSearchParams) => ({ ...prev, page }) })
          }
          showCounter
        />
      )}
    </div>
  );
}
