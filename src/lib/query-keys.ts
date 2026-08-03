/**
 * Typed query-key factories for TanStack Query.
 *
 * Covers notification, consultation, extension, assignment, user, template,
 * discussion, settings, and gradebook domains.
 */

export const notificationKeys = {
  all: () => ['notifications'] as const,
  unreadCount: () => ['notifications', 'unreadCount'] as const,
  list: (filters?: { limit?: number; type?: string; unreadOnly?: boolean }) =>
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

export const discussionKeys = {
  all: () => ['discussions'] as const,
  list: (checkpointId: number, page: number) =>
    ['discussions', 'list', checkpointId, page] as const,
  detail: (checkpointId: number) => ['discussions', 'detail', checkpointId] as const,
};

export const settingsKeys = {
  currentUser: () => ['settings', 'currentUser'] as const,
  activeSessions: () => ['settings', 'activeSessions'] as const,
  twoFactorStatus: () => ['settings', 'twoFactorStatus'] as const,
  accessibility: () => ['settings', 'accessibility'] as const,
  calendarFeed: () => ['settings', 'calendar-feed'] as const,
};

export const gradebookKeys = {
  studentFinalGrade: (assignmentId: number) =>
    ['gradebook', 'studentFinalGrade', assignmentId] as const,
};

export const feedbackSnippetKeys = {
  all: () => ['feedbackSnippets'] as const,
  list: (filters: { archived: boolean; search: string; page: number; limit: number }) =>
    ['feedbackSnippets', 'list', filters] as const,
};
