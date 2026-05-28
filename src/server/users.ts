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

export const listUsers = createServerFn({ method: 'GET' }).handler(
  async (args: { data: unknown }) => {
    const { listUsersHandler } = await import('./users.server');
    const data = ListUsersSchema.parse(args.data);
    return listUsersHandler({ data });
  },
);

export const getUser = createServerFn({ method: 'GET' }).handler(
  async (args: { data: unknown }) => {
    const { getUserHandler } = await import('./users.server');
    const data = UserIdParamSchema.parse(args.data);
    return getUserHandler({ data });
  },
);

export const createUser = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { createUserHandler } = await import('./users.server');
    const data = CreateUserSchema.parse(args.data);
    return createUserHandler({ data });
  },
);

export const updateUser = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { updateUserHandler } = await import('./users.server');
    const data = UpdateUserSchema.extend({ id: z.string() }).parse(args.data);
    return updateUserHandler({ data });
  },
);

export const deleteUser = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { deleteUserHandler } = await import('./users.server');
    const data = UserIdParamSchema.parse(args.data);
    return deleteUserHandler({ data });
  },
);

export const generateSetupLink = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { generateSetupLinkHandler } = await import('./users.server');
    const data = UserIdParamSchema.parse(args.data);
    return generateSetupLinkHandler({ data });
  },
);
