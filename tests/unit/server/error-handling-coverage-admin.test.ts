/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn(() => ({ 'user-agent': 'test', 'x-forwarded-for': '127.0.0.1' })),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn(() => 'mock-file-key'),
  generatePresignedUploadUrl: vi.fn(() => {
    throw new Error('storage failure');
  }),
  generatePresignedDownloadUrl: vi.fn(() => {
    throw new Error('storage failure');
  }),
}));

import { getSessionFromHeaders } from '@/server/auth';
import { getDb } from '@/db/index';

import {
  createAssignmentHandler,
  listInstructorAssignmentsHandler,
  getAssignmentDetailHandler,
} from '@/server/assignments.server';
import { unlockCheckpointHandler, extendDeadlineHandler } from '@/server/assignments-extras.server';
import { listAuditLogsHandler, getAuditLogDetailHandler } from '@/server/audit-log.server';
import { bulkCreateUsersHandler } from '@/server/bulk-import.server';
import {
  listConsultationsHandler,
  getConsultationDetailHandler,
  listPendingConsultationsHandler,
  verifyConsultationHandler,
  rejectConsultationHandler,
} from '@/server/consultations.server';
import { getAdminDashboardDataHandler } from '@/server/dashboard-admin.server';
import { getInstructorDashboardDataHandler } from '@/server/dashboard-instructor.server';
import { listExtensionRequestsHandler } from '@/server/extensions.server';
import {
  approveExtensionHandler,
  rejectExtensionHandler,
  bulkExtendHandler,
} from '@/server/extensions-extras.server';
import { getPresignedReviewFeedbackUploadUrlHandler } from '@/server/files.server';
import { listInstructorAssignmentsForFilterHandler } from '@/server/instructor-assignments-filter.server';
import { createNotificationHandler } from '@/server/notifications.server';
import {
  listPendingReviewsHandler,
  getReviewDetailHandler,
  submitReviewHandler,
} from '@/server/reviews.server';
import { openForReviewHandler, getLatestReviewHandler } from '@/server/reviews-extras.server';
import {
  listTemplatesHandler,
  getTemplateHandler,
  createTemplateHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
  duplicateTemplateHandler,
  listTemplateAssignmentsHandler,
} from '@/server/templates.server';
import {
  listUsersHandler,
  getUserHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  generateSetupLinkHandler,
} from '@/server/users.server';

type TestCase = {
  label: string;
  handler: unknown;
  role: 'admin' | 'instructor';
  input?: Record<string, unknown>;
  argsMode?: 'wrapper' | 'direct';
};

const baseDate = new Date('2030-01-01T00:00:00Z');

function buildSession(role: 'admin' | 'instructor' | 'student') {
  return {
    user: {
      id: `${role}-1`,
      role,
      name: role.charAt(0).toUpperCase() + role.slice(1),
      email: `${role}@example.com`,
      locale: 'en',
      emailVerified: true,
      image: null as string | null,
    },
    session: {
      id: `session-${role}`,
      token: `token-${role}`,
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    },
  };
}

function adminSession() {
  return buildSession('admin');
}

function instructorSession() {
  return buildSession('instructor');
}

function studentSession() {
  return buildSession('student');
}

function anySession() {
  return studentSession();
}

const throwingDb = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === 'then') {
        return (_resolve: unknown, reject: (reason: unknown) => void) => {
          const err = new Error('DB failure');
          if (typeof reject === 'function') {
            reject(err);
          } else {
            throw err;
          }
        };
      }
      return (..._args: unknown[]) => throwingDb;
    },
  },
) as ReturnType<typeof getDb>;

const cases: TestCase[] = [
  {
    label: 'assignments.createAssignmentHandler',
    handler: createAssignmentHandler,
    role: 'instructor',
    input: { templateId: 1, studentIds: ['student-1'] },
  },
  {
    label: 'assignments.listInstructorAssignmentsHandler',
    handler: listInstructorAssignmentsHandler,
    role: 'instructor',
    input: { page: 1, limit: 10 },
  },
  {
    label: 'assignments.getAssignmentDetailHandler',
    handler: getAssignmentDetailHandler,
    role: 'instructor',
    input: { id: 1 },
  },
  {
    label: 'assignments-extras.unlockCheckpointHandler',
    handler: unlockCheckpointHandler,
    role: 'instructor',
    input: { checkpointId: 1 },
  },
  {
    label: 'assignments-extras.extendDeadlineHandler',
    handler: extendDeadlineHandler,
    role: 'instructor',
    input: { checkpointId: 1, newDueDate: baseDate, reason: 'reason' },
  },

  {
    label: 'audit-log.listAuditLogsHandler',
    handler: listAuditLogsHandler,
    role: 'admin',
    input: { page: 1, limit: 10 },
  },
  {
    label: 'audit-log.getAuditLogDetailHandler',
    handler: getAuditLogDetailHandler,
    role: 'admin',
    input: { id: 1 },
  },

  {
    label: 'bulk-import.bulkCreateUsersHandler',
    handler: bulkCreateUsersHandler,
    role: 'admin',
    input: {
      rows: [{ name: 'Test', email: 'test@example.com', role: 'student' }],
      dryRun: false,
    },
  },

  {
    label: 'consultations.listConsultationsHandler',
    handler: listConsultationsHandler,
    role: 'instructor',
    input: { page: 1, limit: 10 },
  },
  {
    label: 'consultations.getConsultationDetailHandler',
    handler: getConsultationDetailHandler,
    role: 'instructor',
    input: { id: 1 },
  },
  {
    label: 'consultations.listPendingConsultationsHandler',
    handler: listPendingConsultationsHandler,
    role: 'instructor',
    input: { page: 1, limit: 10 },
  },
  {
    label: 'consultations.verifyConsultationHandler',
    handler: verifyConsultationHandler,
    role: 'instructor',
    input: { id: 1 },
  },
  {
    label: 'consultations.rejectConsultationHandler',
    handler: rejectConsultationHandler,
    role: 'instructor',
    input: { id: 1, reason: 'reason' },
  },

  {
    label: 'dashboard-admin.getAdminDashboardDataHandler',
    handler: getAdminDashboardDataHandler,
    role: 'admin',
    input: {},
  },
  {
    label: 'dashboard-instructor.getInstructorDashboardDataHandler',
    handler: getInstructorDashboardDataHandler,
    role: 'instructor',
    input: {},
  },

  {
    label: 'extensions.listExtensionRequestsHandler',
    handler: listExtensionRequestsHandler,
    role: 'instructor',
    input: { page: 1, limit: 10 },
  },
  {
    label: 'extensions-extras.approveExtensionHandler',
    handler: approveExtensionHandler,
    role: 'instructor',
    input: { id: 1, comment: 'ok' },
  },
  {
    label: 'extensions-extras.rejectExtensionHandler',
    handler: rejectExtensionHandler,
    role: 'instructor',
    input: { id: 1, reason: 'no' },
  },
  {
    label: 'extensions-extras.bulkExtendHandler',
    handler: bulkExtendHandler,
    role: 'instructor',
    input: { studentIds: ['student-1'], checkpointId: 1, extraDays: 3, reason: 'bulk' },
  },

  {
    label: 'files.getPresignedReviewFeedbackUploadUrlHandler',
    handler: getPresignedReviewFeedbackUploadUrlHandler,
    role: 'instructor',
    input: { extension: 'pdf', contentType: 'application/pdf' },
  },

  {
    label: 'instructor-assignments-filter.listInstructorAssignmentsForFilterHandler',
    handler: listInstructorAssignmentsForFilterHandler,
    role: 'instructor',
    input: {},
  },

  {
    label: 'notifications.createNotificationHandler',
    handler: createNotificationHandler,
    role: 'admin',
    input: { userId: 'user-1', type: 'system', title: 't', message: 'm', channel: 'in_app' },
  },

  {
    label: 'reviews.listPendingReviewsHandler',
    handler: listPendingReviewsHandler,
    role: 'instructor',
    input: { page: 1, limit: 10 },
  },
  {
    label: 'reviews.getReviewDetailHandler',
    handler: getReviewDetailHandler,
    role: 'instructor',
    input: { id: 1 },
  },
  {
    label: 'reviews.submitReviewHandler',
    handler: submitReviewHandler,
    role: 'instructor',
    input: { submissionId: 1, decision: 'pass' },
  },
  {
    label: 'reviews-extras.openForReviewHandler',
    handler: openForReviewHandler,
    role: 'instructor',
    input: { checkpointId: 1 },
  },
  {
    label: 'reviews-extras.getLatestReviewHandler',
    handler: getLatestReviewHandler,
    role: 'instructor',
    input: { submissionId: 1 },
  },

  {
    label: 'templates.listTemplatesHandler',
    handler: listTemplatesHandler,
    role: 'admin',
    input: { page: 1, limit: 10 },
  },
  {
    label: 'templates.getTemplateHandler',
    handler: getTemplateHandler,
    role: 'admin',
    input: { id: 1 },
  },
  {
    label: 'templates.createTemplateHandler',
    handler: createTemplateHandler,
    role: 'admin',
    input: { name: 't', description: 'd', checkpoints: [] },
  },
  {
    label: 'templates.updateTemplateHandler',
    handler: updateTemplateHandler,
    role: 'admin',
    input: { id: 1, name: 't', description: 'd', checkpoints: [] },
  },
  {
    label: 'templates.deleteTemplateHandler',
    handler: deleteTemplateHandler,
    role: 'admin',
    input: { id: 1 },
  },
  {
    label: 'templates.duplicateTemplateHandler',
    handler: duplicateTemplateHandler,
    role: 'admin',
    input: { id: 1 },
  },
  {
    label: 'templates.listTemplateAssignmentsHandler',
    handler: listTemplateAssignmentsHandler,
    role: 'admin',
    input: { templateId: 1, page: 1, limit: 20 },
  },

  {
    label: 'users.listUsersHandler',
    handler: listUsersHandler,
    role: 'admin',
    input: { page: 1, limit: 10 },
  },
  {
    label: 'users.getUserHandler',
    handler: getUserHandler,
    role: 'admin',
    input: { id: 'user-1' },
  },
  {
    label: 'users.createUserHandler',
    handler: createUserHandler,
    role: 'admin',
    input: { email: 'a@example.com', name: 'A', role: 'student' },
  },
  {
    label: 'users.updateUserHandler',
    handler: updateUserHandler,
    role: 'admin',
    input: { id: 'user-1', name: 'B' },
  },
  {
    label: 'users.deleteUserHandler',
    handler: deleteUserHandler,
    role: 'admin',
    input: { id: 'user-1' },
  },
  {
    label: 'users.generateSetupLinkHandler',
    handler: generateSetupLinkHandler,
    role: 'admin',
    input: { email: 'a@example.com' },
  },
];

describe('server error handling catch coverage for admin and instructor handlers', () => {
  beforeEach(() => {
    vi.mocked(getDb).mockReturnValue(throwingDb);
  });

  it.each(cases)(
    '$label returns INTERNAL server error when the database fails',
    async ({ handler, role, input, argsMode }) => {
      const session = role === 'admin' ? adminSession() : instructorSession();
      vi.mocked(getSessionFromHeaders).mockResolvedValue(session);

      const handlerFn = handler as (args: Record<string, unknown>) => Promise<unknown>;
      const args = argsMode === 'direct' ? (input ?? {}) : { data: input ?? {} };
      const result = (await handlerFn(args)) as {
        error?: { code: string; message: string };
      };

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('INTERNAL');
      expect(result.error?.message).toBe('Internal Server Error');
    },
  );
});
