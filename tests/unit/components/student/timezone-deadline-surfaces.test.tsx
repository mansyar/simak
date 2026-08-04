import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const {
  mockFormatDate,
  mockFormatDateShort,
  mockFormatRelativeTime,
  mockUseStudentTimezone,
  mockLocale,
} = vi.hoisted(() => ({
  mockFormatDate: vi.fn(() => 'formatted date'),
  mockFormatDateShort: vi.fn(() => 'formatted short date'),
  mockFormatRelativeTime: vi.fn(() => 'relative time'),
  mockUseStudentTimezone: vi.fn(() => ({ timezone: 'America/Los_Angeles', hydrated: true })),
  mockLocale: { value: 'en' as 'en' | 'id' },
}));

vi.mock('@/lib/format-date', () => ({ formatDate: mockFormatDate }));
vi.mock('@/lib/format', () => ({
  formatDateShort: mockFormatDateShort,
  formatRelativeTime: mockFormatRelativeTime,
}));
vi.mock('@/hooks/use-student-timezone', () => ({ useStudentTimezone: mockUseStudentTimezone }));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    get locale() {
      return mockLocale.value;
    },
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { CheckpointCard } from '@/components/student/assignments/CheckpointCard';
import { AssignmentDetailHeader } from '@/components/student/assignments/AssignmentDetailHeader';
import { StudentAssignmentCard } from '@/components/student/assignments/StudentAssignmentCard';
import { StudentNextActions } from '@/components/dashboard/StudentNextActions';
import { ConsultationList } from '@/components/consultations/ConsultationList';
import { FileList } from '@/components/files/file-list';
import { SubmissionStatus } from '@/components/files/submission-status';
import { ExtensionHistoryList } from '@/components/student/extensions/ExtensionHistoryList';

describe('student deadline timezone surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocale.value = 'en';
    mockUseStudentTimezone.mockReturnValue({ timezone: 'America/Los_Angeles', hydrated: true });
  });

  it('passes the resolved timezone to dashboard assignment and checkpoint deadlines', () => {
    const dueDate = '2026-03-08T09:30:00.000Z';
    render(
      <StudentDashboard
        data={{
          activeAssignments: [
            {
              id: 1,
              title: 'Thesis',
              finalDeadline: new Date(dueDate),
              templateName: 'Template',
              templateType: 'Thesis',
              progressPercent: 20,
              currentState: 'in_progress',
            },
          ],
          upcomingDeadlines: [
            {
              assignmentId: 1,
              assignmentTitle: 'Thesis',
              checkpointName: 'Proposal',
              dueDate,
              state: 'locked',
              isOverdue: true,
              daysRemaining: -1,
            },
          ],
          pendingReviews: [],
          consultationReminders: [],
        }}
      />,
    );

    expect(mockFormatDateShort).toHaveBeenCalledWith(
      new Date(dueDate),
      'en',
      'America/Los_Angeles',
    );
    expect(mockFormatDate).toHaveBeenCalledWith(dueDate, 'en', 'short', 'America/Los_Angeles');
    expect(mockFormatRelativeTime).toHaveBeenCalledWith(dueDate, 'en');
    expect(screen.getByText('studentDashboard.overdue')).toBeDefined();
  });

  it('keeps null deadlines and non-deadline dashboard dates safe', () => {
    const consultationDate = new Date('2026-03-08T09:30:00.000Z');
    render(
      <StudentDashboard
        data={{
          activeAssignments: [],
          upcomingDeadlines: [
            {
              assignmentId: 1,
              assignmentTitle: 'Thesis',
              checkpointName: 'Proposal',
              dueDate: null,
              state: 'in_progress',
              isOverdue: false,
              daysRemaining: null,
            },
          ],
          pendingReviews: [],
          consultationReminders: [
            {
              consultationId: 1,
              assignmentTitle: 'Thesis',
              checkpointName: 'Proposal',
              consultationDate,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('studentDashboard.noDeadline')).toBeDefined();
    expect(mockFormatDate).toHaveBeenCalledWith(
      consultationDate,
      'en',
      'short',
      'America/Los_Angeles',
    );
    expect(mockFormatDate).not.toHaveBeenCalledWith(null, 'en', 'short', 'America/Los_Angeles');
  });

  it('passes the resolved timezone to checkpoint due dates while preserving overdue state', () => {
    const dueDate = new Date('2026-03-08T09:30:00.000Z');
    render(
      <CheckpointCard
        assignmentId={1}
        checkpoint={{
          id: 1,
          name: 'Proposal',
          order: 1,
          state: 'unlocked',
          dueDate,
          minConsultations: 0,
          verifiedConsultationCount: 0,
        }}
      />,
    );

    expect(mockFormatDateShort).toHaveBeenCalledWith(dueDate, 'en', 'America/Los_Angeles');
    expect(mockFormatRelativeTime).toHaveBeenCalledWith(dueDate, 'en');
  });

  it('passes the resolved timezone to assignment final and effective deadlines', () => {
    const finalDeadline = new Date('2026-06-01T00:00:00.000Z');
    const effectiveDeadline = new Date('2026-07-15T00:00:00.000Z');

    render(
      <AssignmentDetailHeader
        detail={{
          title: 'Thesis',
          description: null,
          finalDeadline,
          effectiveDeadline,
          instructorName: 'Instructor',
          templateName: 'Template',
          templateType: 'Thesis',
        }}
      />,
    );
    render(
      <StudentAssignmentCard
        assignment={{
          id: 1,
          title: 'Thesis',
          finalDeadline,
          templateName: 'Template',
          templateType: 'Thesis',
          progressPercent: 20,
        }}
      />,
    );

    expect(mockFormatDate).toHaveBeenCalledWith(
      effectiveDeadline,
      'en',
      'short',
      'America/Los_Angeles',
    );
    expect(mockFormatDate).toHaveBeenCalledWith(
      finalDeadline,
      'en',
      'short',
      'America/Los_Angeles',
    );
  });

  it('uses the UTC fallback returned by the timezone resolver', () => {
    mockUseStudentTimezone.mockReturnValue({ timezone: 'UTC', hydrated: true });
    const dueDate = new Date('2026-06-01T00:00:00.000Z');

    render(
      <CheckpointCard
        assignmentId={1}
        checkpoint={{
          id: 1,
          name: 'Proposal',
          order: 1,
          state: 'locked',
          dueDate,
          minConsultations: 0,
          verifiedConsultationCount: 0,
        }}
      />,
    );

    expect(mockFormatDateShort).toHaveBeenCalledWith(dueDate, 'en', 'UTC');
  });

  it('passes the student timezone to consultation, submission, review, and extension dates', () => {
    const date = new Date('2026-03-08T09:30:00.000Z');

    render(
      <StudentNextActions
        data={{
          primaryActions: [
            {
              assignmentId: 1,
              assignmentTitle: 'Thesis',
              checkpointId: 10,
              checkpointName: 'Proposal',
              dueDate: new Date(date),
              kind: 'submit',
              priority: 'dated',
              submissionId: null,
              href: '/student/assignments/1/checkpoints/10',
            },
          ],
          waitingSummary: {
            submitted: { count: 0, representatives: [] },
            underReview: { count: 0, representatives: [] },
          },
        }}
      />,
    );
    render(
      <ConsultationList
        consultations={[
          {
            id: 1,
            checkpointName: 'Proposal',
            sessionType: 'internal',
            externalConsultantName: null,
            notes: null,
            status: 'pending',
            createdAt: date,
          },
        ]}
      />,
    );
    render(
      <FileList
        submissions={[
          { id: 1, version: 1, fileName: 'proposal.pdf', fileSize: 100, uploadedAt: date },
        ]}
      />,
    );
    render(
      <SubmissionStatus
        review={{ decision: 'revise', revisionDeadline: date, reviewedAt: date }}
      />,
    );
    render(
      <ExtensionHistoryList
        items={[
          {
            id: 1,
            category: 'research',
            extensionDays: 3,
            status: 'pending',
            reason: null,
            createdAt: date,
            resolvedAt: null,
            resolutionReason: null,
            checkpointName: 'Proposal',
          },
        ]}
      />,
    );

    expect(mockFormatDate).toHaveBeenCalledWith(date, 'en', 'short', 'America/Los_Angeles');
  });

  it('passes the active locale and timezone together at a date boundary', () => {
    mockLocale.value = 'id';
    const date = new Date('2026-03-08T00:30:00.000Z');

    render(
      <StudentNextActions
        data={{
          primaryActions: [
            {
              assignmentId: 1,
              assignmentTitle: 'Thesis',
              checkpointId: 10,
              checkpointName: 'Proposal',
              dueDate: date,
              kind: 'submit',
              priority: 'dated',
              submissionId: null,
              href: '/student/assignments/1/checkpoints/10',
            },
          ],
          waitingSummary: {
            submitted: { count: 0, representatives: [] },
            underReview: { count: 0, representatives: [] },
          },
        }}
      />,
    );

    expect(mockFormatDate).toHaveBeenCalledWith(date, 'id', 'short', 'America/Los_Angeles');
  });

  it('uses a neutral placeholder until timezone detection has hydrated', () => {
    mockUseStudentTimezone.mockReturnValue({ timezone: 'UTC', hydrated: false });

    render(
      <StudentDashboard
        data={{
          activeAssignments: [
            {
              id: 1,
              title: 'Thesis',
              finalDeadline: new Date('2026-06-01T00:00:00.000Z'),
              templateName: 'Template',
              templateType: 'Thesis',
              progressPercent: 20,
              currentState: 'in_progress',
            },
          ],
          upcomingDeadlines: [],
          pendingReviews: [],
          consultationReminders: [],
        }}
      />,
    );

    expect(mockFormatDateShort).not.toHaveBeenCalled();
    expect(screen.getByText(/studentDashboard\.deadline.*—/)).toBeDefined();
  });
});
