/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Clock: () => <div data-testid="clock-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  MessageSquare: () => <div data-testid="message-square-icon" />,
  ClipboardList: () => <div data-testid="clipboard-list-icon" />,
}));

import { StudentDashboard } from '@/components/dashboard/StudentDashboard';

describe('StudentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render error state', () => {
    const data = {
      activeAssignments: [],
      upcomingDeadlines: [],
      pendingReviews: [],
      consultationReminders: [],
      error: 'Failed to load',
    };

    render(<StudentDashboard data={data} />);

    expect(screen.getByText('common.error')).toBeDefined();
  });

  it('should render empty state for all widgets', () => {
    const data = {
      activeAssignments: [],
      upcomingDeadlines: [],
      pendingReviews: [],
      consultationReminders: [],
    };

    render(<StudentDashboard data={data} />);

    expect(screen.getByText('studentDashboard.noActiveAssignments')).toBeDefined();
    expect(screen.getByText('studentDashboard.noUpcomingDeadlines')).toBeDefined();
    expect(screen.getByText('studentDashboard.noPendingReviews')).toBeDefined();
    expect(screen.getByText('studentDashboard.noConsultationReminders')).toBeDefined();
  });

  it('should render active assignments', () => {
    const data = {
      activeAssignments: [
        {
          id: 1,
          title: 'Thesis Assignment',
          finalDeadline: '2026-06-01',
          templateName: 'Thesis Template',
          templateType: 'thesis',
          progressPercent: 50,
          currentState: 'unlocked',
        },
      ],
      upcomingDeadlines: [],
      pendingReviews: [],
      consultationReminders: [],
    };

    render(<StudentDashboard data={data} />);

    expect(screen.getByText('Thesis Assignment')).toBeDefined();
    expect(screen.getByText('thesis')).toBeDefined();
    expect(screen.getByText('50%')).toBeDefined();
  });

  it('should render upcoming deadlines', () => {
    const data = {
      activeAssignments: [],
      upcomingDeadlines: [
        {
          assignmentId: 1,
          assignmentTitle: 'Thesis Assignment',
          checkpointName: 'Chapter 1',
          dueDate: '2026-06-01',
          state: 'unlocked',
          isOverdue: false,
        },
      ],
      pendingReviews: [],
      consultationReminders: [],
    };

    render(<StudentDashboard data={data} />);

    expect(screen.getByText('Chapter 1')).toBeDefined();
    expect(screen.getByText('Thesis Assignment')).toBeDefined();
  });

  it('should render overdue deadline with badge', () => {
    const data = {
      activeAssignments: [],
      upcomingDeadlines: [
        {
          assignmentId: 1,
          assignmentTitle: 'Thesis Assignment',
          checkpointName: 'Chapter 1',
          dueDate: '2026-01-01',
          state: 'unlocked',
          isOverdue: true,
        },
      ],
      pendingReviews: [],
      consultationReminders: [],
    };

    render(<StudentDashboard data={data} />);

    expect(screen.getByText('studentDashboard.overdue')).toBeDefined();
  });

  it('should render pending reviews', () => {
    const data = {
      activeAssignments: [],
      upcomingDeadlines: [],
      pendingReviews: [
        {
          submissionId: 1,
          assignmentTitle: 'Thesis Assignment',
          checkpointName: 'Chapter 1',
          submittedAt: '2026-05-20',
          waitTimeDays: 3,
        },
      ],
      consultationReminders: [],
    };

    render(<StudentDashboard data={data} />);

    expect(screen.getByText('Chapter 1')).toBeDefined();
    expect(screen.getByText('Thesis Assignment')).toBeDefined();
    expect(screen.getByText('studentDashboard.underReview')).toBeDefined();
  });

  it('should render consultation reminders', () => {
    const data = {
      activeAssignments: [],
      upcomingDeadlines: [],
      pendingReviews: [],
      consultationReminders: [
        {
          consultationId: 1,
          assignmentTitle: 'Thesis Assignment',
          checkpointName: 'Chapter 1',
          consultationDate: '2026-05-25',
        },
      ],
    };

    render(<StudentDashboard data={data} />);

    expect(screen.getByText('Chapter 1')).toBeDefined();
    expect(screen.getByText('Thesis Assignment')).toBeDefined();
    expect(screen.getByText('studentDashboard.pending')).toBeDefined();
  });
});
