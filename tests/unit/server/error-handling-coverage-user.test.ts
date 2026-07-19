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
  listStudentAssignmentsHandler,
  getStudentAssignmentDetailHandler,
} from '@/server/assignments-extras.server';
import { logConsultationHandler } from '@/server/consultations.server';
import { listVerifiedCountsHandler } from '@/server/consultations-extras.server';
import { getStudentDashboardDataHandler } from '@/server/dashboard-student.server';
import {
  requestExtensionHandler,
  listMyExtensionRequestsHandler,
} from '@/server/extensions.server';
import {
  getPresignedUploadUrlHandler,
  getPresignedDownloadUrlHandler,
} from '@/server/files.server';
import {
  listNotificationsHandler,
  markReadHandler,
  markAllReadHandler,
  getUnreadCountHandler,
} from '@/server/notifications.server';
import {
  listActiveSessionsHandler,
  revokeSessionHandler,
  revokeAllOtherSessionsHandler,
} from '@/server/sessions.server';
import {
  updateProfileHandler,
  getPresignedAvatarUploadUrlHandler,
  getCurrentUserHandler,
  updateUserSettingsHandler,
} from '@/server/settings.server';
import {
  submitCheckpointHandler,
  listSubmissionsHandler,
  getSubmissionDetailHandler,
} from '@/server/submissions.server';

type TestCase = {
  label: string;
  handler: unknown;
  role: 'student' | 'authenticated';
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
    label: 'assignments-extras.listStudentAssignmentsHandler',
    handler: listStudentAssignmentsHandler,
    role: 'student',
    input: { page: 1, limit: 10, status: 'active' },
  },
  {
    label: 'assignments-extras.getStudentAssignmentDetailHandler',
    handler: getStudentAssignmentDetailHandler,
    role: 'student',
    input: { id: 1 },
  },

  {
    label: 'consultations.logConsultationHandler',
    handler: logConsultationHandler,
    role: 'student',
    input: { assignmentId: 1, checkpointId: 1, note: 'note' },
  },
  {
    label: 'consultations-extras.listVerifiedCountsHandler',
    handler: listVerifiedCountsHandler,
    role: 'authenticated',
    input: { assignmentId: 1 },
  },

  {
    label: 'dashboard-student.getStudentDashboardDataHandler',
    handler: getStudentDashboardDataHandler,
    role: 'student',
    input: {},
  },

  {
    label: 'extensions.requestExtensionHandler',
    handler: requestExtensionHandler,
    role: 'student',
    input: { checkpointId: 1, requestedDays: 3, reason: 'reason' },
  },
  {
    label: 'extensions.listMyExtensionRequestsHandler',
    handler: listMyExtensionRequestsHandler,
    role: 'student',
    input: { assignmentId: 1, page: 1, limit: 20 },
  },

  {
    label: 'files.getPresignedUploadUrlHandler',
    handler: getPresignedUploadUrlHandler,
    role: 'student',
    input: {
      checkpointId: 1,
      extension: 'docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  },
  {
    label: 'files.getPresignedDownloadUrlHandler',
    handler: getPresignedDownloadUrlHandler,
    role: 'student',
    input: { submissionId: 1 },
  },

  {
    label: 'notifications.listNotificationsHandler',
    handler: listNotificationsHandler,
    role: 'authenticated',
    input: { page: 1, limit: 10 },
  },
  {
    label: 'notifications.markReadHandler',
    handler: markReadHandler,
    role: 'authenticated',
    input: { notificationId: 1 },
  },
  {
    label: 'notifications.markAllReadHandler',
    handler: markAllReadHandler,
    role: 'authenticated',
    input: {},
  },
  {
    label: 'notifications.getUnreadCountHandler',
    handler: getUnreadCountHandler,
    role: 'authenticated',
    input: {},
  },

  {
    label: 'sessions.listActiveSessionsHandler',
    handler: listActiveSessionsHandler,
    role: 'authenticated',
    input: {},
  },
  {
    label: 'sessions.revokeSessionHandler',
    handler: revokeSessionHandler,
    role: 'authenticated',
    input: { sessionToken: 'token' },
  },
  {
    label: 'sessions.revokeAllOtherSessionsHandler',
    handler: revokeAllOtherSessionsHandler,
    role: 'authenticated',
    input: {},
  },

  {
    label: 'settings.updateProfileHandler',
    handler: updateProfileHandler,
    role: 'authenticated',
    input: { name: 'New Name' },
  },
  {
    label: 'settings.getPresignedAvatarUploadUrlHandler',
    handler: getPresignedAvatarUploadUrlHandler,
    role: 'authenticated',
    input: { extension: 'jpg' },
  },
  {
    label: 'settings.getCurrentUserHandler',
    handler: getCurrentUserHandler,
    role: 'authenticated',
    input: {},
    argsMode: 'direct',
  },
  {
    label: 'settings.updateUserSettingsHandler',
    handler: updateUserSettingsHandler,
    role: 'authenticated',
    input: { reducedMotion: true },
  },

  {
    label: 'submissions.submitCheckpointHandler',
    handler: submitCheckpointHandler,
    role: 'student',
    input: { checkpointId: 1, fileKey: 'key' },
  },
  {
    label: 'submissions.listSubmissionsHandler',
    handler: listSubmissionsHandler,
    role: 'student',
    input: { checkpointId: 1, page: 1, limit: 20 },
  },
  {
    label: 'submissions.getSubmissionDetailHandler',
    handler: getSubmissionDetailHandler,
    role: 'student',
    input: { id: 1 },
  },
];

const throwUnusedDate = baseDate;
void throwUnusedDate;

describe('server error handling catch coverage for student and authenticated handlers', () => {
  beforeEach(() => {
    vi.mocked(getDb).mockReturnValue(throwingDb);
  });

  it.each(cases)(
    '$label returns INTERNAL server error when the database fails',
    async ({ handler, role, input, argsMode }) => {
      const session = role === 'student' ? studentSession() : anySession();
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
