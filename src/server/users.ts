// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in users.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const VALID_CREATE_ROLES = ['admin', 'instructor', 'student'] as const;
const VALID_ROLES = ['superadmin', 'admin', 'instructor', 'student'] as const;

export const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(VALID_CREATE_ROLES, { message: 'Invalid role' }),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
});

export const ListUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().optional().default(''),
  role: z.enum(VALID_ROLES).optional(),
});

export const UserIdParamSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

export const listUsers = createServerFn({ method: 'GET' })
  .inputValidator(ListUsersSchema)
  .handler(async ({ data }) => {
    const { listUsersHandler } = await import('./users.server');
    return listUsersHandler({ data });
  });

export const getUser = createServerFn({ method: 'GET' })
  .inputValidator(UserIdParamSchema)
  .handler(async ({ data }) => {
    const { getUserHandler } = await import('./users.server');
    return getUserHandler({ data });
  });

export const createUser = createServerFn({ method: 'POST' })
  .inputValidator(CreateUserSchema)
  .handler(async ({ data }) => {
    const { createUserHandler } = await import('./users.server');
    return createUserHandler({ data });
  });

export const updateUser = createServerFn({ method: 'POST' })
  .inputValidator(UpdateUserSchema.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const { updateUserHandler } = await import('./users.server');
    return updateUserHandler({ data });
  });

export const deleteUser = createServerFn({ method: 'POST' })
  .inputValidator(UserIdParamSchema)
  .handler(async ({ data }) => {
    const { deleteUserHandler } = await import('./users.server');
    return deleteUserHandler({ data });
  });

export const generateSetupLink = createServerFn({ method: 'POST' })
  .inputValidator(UserIdParamSchema)
  .handler(async ({ data }) => {
    const { generateSetupLinkHandler } = await import('./users.server');
    return generateSetupLinkHandler({ data });
  });

export const ListInstructorActiveAssignmentsSchema = z.object({
  instructorId: z.string().min(1, 'Instructor ID is required'),
});

export const listInstructorActiveAssignments = createServerFn({ method: 'GET' })
  .inputValidator(ListInstructorActiveAssignmentsSchema)
  .handler(async ({ data }) => {
    const { listInstructorActiveAssignmentsHandler } = await import('./users.server');
    return listInstructorActiveAssignmentsHandler({ data });
  });
