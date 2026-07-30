// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in users.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import {
  createUserHandler,
  deleteUserHandler,
  generateSetupLinkHandler,
  getUserHandler,
  listInstructorActiveAssignmentsHandler,
  listUsersHandler,
  updateUserHandler,
} from './users.server';

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

export const listUsers = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListUsersSchema)
  .handler(async ({ data }) => {
    return listUsersHandler({ data });
  });

export const getUser = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(UserIdParamSchema)
  .handler(async ({ data }) => {
    return getUserHandler({ data });
  });

export const createUser = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CreateUserSchema)
  .handler(async ({ data }) => {
    return createUserHandler({ data });
  });

export const updateUser = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UpdateUserSchema.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    return updateUserHandler({ data });
  });

export const deleteUser = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UserIdParamSchema)
  .handler(async ({ data }) => {
    return deleteUserHandler({ data });
  });

export const generateSetupLink = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UserIdParamSchema)
  .handler(async ({ data }) => {
    return generateSetupLinkHandler({ data });
  });

export const ListInstructorActiveAssignmentsSchema = z.object({
  instructorId: z.string().min(1, 'Instructor ID is required'),
});

export const listInstructorActiveAssignments = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListInstructorActiveAssignmentsSchema)
  .handler(async ({ data }) => {
    return listInstructorActiveAssignmentsHandler({ data });
  });
