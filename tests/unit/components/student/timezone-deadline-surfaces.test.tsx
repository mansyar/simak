import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { mockFormatDate, mockFormatDateShort, mockFormatRelativeTime, mockUseStudentTimezone } =
  vi.hoisted(() => ({
    mockFormatDate: vi.fn(() => 'formatted date'),
    mockFormatDateShort: vi.fn(() => 'formatted short date'),
    mockFormatRelativeTime: vi.fn(() => 'relative time'),
    mockUseStudentTimezone: vi.fn(() => 'America/Los_Angeles'),
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
    locale: 'en' as const,
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

describe('student deadline timezone surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStudentTimezone.mockReturnValue('America/Los_Angeles');
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
    expect(mockFormatDate).toHaveBeenCalledWith(consultationDate, 'en', 'short');
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
    mockUseStudentTimezone.mockReturnValue('UTC');
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
});
