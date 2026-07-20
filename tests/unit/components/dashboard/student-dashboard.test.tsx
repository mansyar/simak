/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { mockFormatDate } = vi.hoisted(() => ({
  mockFormatDate: vi.fn(
    (date: string, locale: string, style: string) => `formatted-${date}-${locale}-${style}`,
  ),
}));

vi.mock('@/lib/format-date', () => ({
  formatDate: mockFormatDate,
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...(actual as any),
    Link: vi.fn().mockImplementation(({ children, ...props }: any) => (
      <a data-mock-link="" href={props.to || '#'} {...props}>
        {children}
      </a>
    )),
  };
});

vi.mock('../../../src/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en' as const,
    setLocale: vi.fn(),
  }),
}));

describe('StudentDashboard component', () => {
  it('should render active assignments section', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(
      <StudentDashboard
        data={{
          activeAssignments: [],
          upcomingDeadlines: [],
          pendingReviews: [],
          consultationReminders: [],
        }}
      />,
    );
    expect(screen.getByText('studentDashboard.activeAssignments')).toBeDefined();
  });

  it('should render upcoming deadlines section', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(
      <StudentDashboard
        data={{
          activeAssignments: [],
          upcomingDeadlines: [],
          pendingReviews: [],
          consultationReminders: [],
        }}
      />,
    );
    expect(screen.getByText('studentDashboard.upcomingDeadlines')).toBeDefined();
  });

  it('should render pending reviews section', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(
      <StudentDashboard
        data={{
          activeAssignments: [],
          upcomingDeadlines: [],
          pendingReviews: [],
          consultationReminders: [],
        }}
      />,
    );
    expect(screen.getByText('studentDashboard.pendingReviews')).toBeDefined();
  });

  it('should render consultation reminders section', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(
      <StudentDashboard
        data={{
          activeAssignments: [],
          upcomingDeadlines: [],
          pendingReviews: [],
          consultationReminders: [],
        }}
      />,
    );
    expect(screen.getByText('studentDashboard.consultationReminders')).toBeDefined();
  });

  it('should show error state when data has error', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(<StudentDashboard data={{ error: 'Unauthorized' } as any} />);
    expect(screen.getByText('common.error')).toBeDefined();
  });
});

describe('StudentDashboard - shared formatDate (UX-20)', () => {
  beforeEach(() => {
    mockFormatDate.mockClear();
  });

  it('uses formatDate for upcoming deadlines with locale and short style', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    const dueDate = '2026-06-15T23:59:59Z';
    render(
      <StudentDashboard
        data={{
          activeAssignments: [],
          upcomingDeadlines: [
            {
              assignmentId: 1,
              assignmentTitle: 'Test Assignment',
              checkpointName: 'Proposal',
              dueDate,
              state: 'in_progress',
              isOverdue: false,
              daysRemaining: 5,
            },
          ],
          pendingReviews: [],
          consultationReminders: [],
        }}
      />,
    );
    expect(mockFormatDate).toHaveBeenCalledWith(dueDate, 'en', 'short');
  });

  it('uses formatDate for consultation reminders with locale and short style', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    const consultationDate = '2026-07-01T10:00:00Z';
    render(
      <StudentDashboard
        data={{
          activeAssignments: [],
          upcomingDeadlines: [],
          pendingReviews: [],
          consultationReminders: [
            {
              consultationId: 1,
              assignmentTitle: 'Test Assignment',
              checkpointName: 'Proposal',
              consultationDate,
            },
          ],
        }}
      />,
    );
    expect(mockFormatDate).toHaveBeenCalledWith(consultationDate, 'en', 'short');
  });

  it('does not call formatDate when dueDate is null', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(
      <StudentDashboard
        data={{
          activeAssignments: [],
          upcomingDeadlines: [
            {
              assignmentId: 1,
              assignmentTitle: 'Test Assignment',
              checkpointName: 'Proposal',
              dueDate: null,
              state: 'in_progress',
              isOverdue: false,
              daysRemaining: null,
            },
          ],
          pendingReviews: [],
          consultationReminders: [],
        }}
      />,
    );
    expect(mockFormatDate).not.toHaveBeenCalled();
  });
});
