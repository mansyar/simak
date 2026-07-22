/**
 * Typed query-key factories for TanStack Query.
 *
 * Only the 6 feature domains touched by the 9 optimistic-UI mutation sites
 * have factories here. Other features keep inline keys until touched.
 */

export const notificationKeys = {
  all: () => ['notifications'] as const,
  unreadCount: () => ['notifications', 'unreadCount'] as const,
  list: (filters?: { page?: number; limit?: number; type?: string; unreadOnly?: boolean }) =>
    ['notifications', 'list', filters ?? {}] as const,
};

export const consultationKeys = {
  all: () => ['consultations'] as const,
  pending: (assignmentId: number, page: number) =>
    ['consultations', 'pending', assignmentId, page] as const,
};

export const extensionKeys = {
  all: () => ['extensions'] as const,
  pending: (assignmentId: number) => ['extensions', 'pending', assignmentId] as const,
};

export const assignmentKeys = {
  all: () => ['assignments'] as const,
  detail: (assignmentId: number) => ['assignments', 'detail', assignmentId] as const,
};

export const userKeys = {
  all: () => ['users'] as const,
  list: (filters?: { page?: number; limit?: number; search?: string; role?: string }) =>
    ['users', 'list', filters ?? {}] as const,
};

export const templateKeys = {
  all: () => ['templates'] as const,
  list: (filters?: { page?: number; limit?: number; search?: string; type?: string }) =>
    ['templates', 'list', filters ?? {}] as const,
};
