/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

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

vi.mock('@/components/ui/email-queue-stat', () => ({
  EmailQueueStat: ({ icon: Icon, color, label, value }: any) => (
    <div data-testid="email-queue-stat" data-color={color} data-label={label}>
      <Icon data-testid="email-queue-icon" />
      <span>{value}</span>
      <p>{label}</p>
    </div>
  ),
}));

vi.mock('@/components/ui/quick-action-card', () => ({
  QuickActionCard: ({ to, label, description, color }: any) => (
    <a data-testid="quick-action-card" href={to} data-color={color}>
      <span>{label}</span>
      <span>{description}</span>
    </a>
  ),
}));

const emptyData = {
  metrics: {
    totalUsers: 0,
    instructors: 0,
    students: 0,
    activeAssignments: 0,
    pendingReviews: 0,
    activeConsultations: 0,
  },
  emailQueueCounts: { pending: 0, sent: 0, failed: 0 },
  recentActivity: [],
  escalationAlerts: [],
};

describe('AdminDashboard component', () => {
  it('should render system metrics section', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    render(<AdminDashboard data={emptyData} />);
    expect(screen.getByText('adminDashboard.totalUsers')).toBeDefined();
  });

  it('should render recent activity section', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    render(<AdminDashboard data={emptyData} />);
    expect(screen.getByText('adminDashboard.recentActivity')).toBeDefined();
  });

  it('should render escalation alerts section', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    render(<AdminDashboard data={emptyData} />);
    expect(screen.getByText('adminDashboard.escalationAlerts')).toBeDefined();
  });

  it('should render quick actions section', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    render(<AdminDashboard data={emptyData} />);
    expect(screen.getByText('adminDashboard.quickActions')).toBeDefined();
  });

  it('should render email queue section', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    render(<AdminDashboard data={emptyData} />);
    expect(screen.getByText('adminDashboard.emailQueue.title')).toBeDefined();
    expect(screen.getByText('adminDashboard.emailQueue.pending')).toBeDefined();
    expect(screen.getByText('adminDashboard.emailQueue.sent')).toBeDefined();
    expect(screen.getByText('adminDashboard.emailQueue.failed')).toBeDefined();
  });

  it('should render email queue counts', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    const dataWithCounts = {
      ...emptyData,
      emailQueueCounts: { pending: 3, sent: 15, failed: 1 },
    };
    render(<AdminDashboard data={dataWithCounts} />);
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
  });

  it('should use EmailQueueStat for email queue stats', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    render(<AdminDashboard data={emptyData} />);
    const stats = screen.getAllByTestId('email-queue-stat');
    expect(stats.length).toBe(3);
    expect(stats[0]).toHaveAttribute('data-color', 'primary');
    expect(stats[1]).toHaveAttribute('data-color', 'success');
    expect(stats[2]).toHaveAttribute('data-color', 'error');
  });

  it('should show error state when data has error', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    render(<AdminDashboard data={{ error: 'Unauthorized' } as any} />);
    expect(screen.getByText('common.error')).toBeDefined();
  });

  it('should use EmptyState primitive (border-dashed container + h3) for error', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    const { container } = render(<AdminDashboard data={{ error: 'Unauthorized' } as any} />);
    // EmptyState renders an h3 title, not a p
    const heading = container.querySelector('h3');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toBe('common.error');
    // EmptyState container has border-dashed class
    const emptyStateContainer = container.querySelector('.border-dashed');
    expect(emptyStateContainer).toBeTruthy();
  });

  it('should render metric values', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    const dataWithMetrics = {
      ...emptyData,
      metrics: {
        totalUsers: 25,
        instructors: 3,
        students: 20,
        activeAssignments: 5,
        pendingReviews: 7,
        activeConsultations: 4,
      },
    };
    render(<AdminDashboard data={dataWithMetrics} />);
    expect(screen.getByText('25')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('should render recent activity items', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    const dataWithActivity = {
      ...emptyData,
      recentActivity: [
        {
          id: 1,
          type: 'submission_received',
          title: 'New submission',
          message: 'Student submitted checkpoint',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    render(<AdminDashboard data={dataWithActivity} />);
    expect(screen.getByText('New submission')).toBeDefined();
    expect(screen.getByText('Student submitted checkpoint')).toBeDefined();
  });

  it('should render escalation alerts', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    const dataWithAlerts = {
      ...emptyData,
      escalationAlerts: [
        {
          submissionId: 1,
          instructorName: 'Dr. Smith',
          assignmentTitle: 'Thesis',
          checkpointName: 'Chapter 1',
          studentName: 'John Doe',
          daysOverdue: 5,
        },
      ],
    };
    render(<AdminDashboard data={dataWithAlerts} />);
    expect(screen.getByText('Dr. Smith')).toBeDefined();
    expect(
      screen.getByText((content) => content.includes('5') && content.includes('daysOverdue')),
    ).toBeDefined();
  });

  it('should render MetricCard with font-display class', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    const { container } = render(<AdminDashboard data={emptyData} />);
    const fontDisplayEls = container.querySelectorAll('.font-display');
    expect(fontDisplayEls.length).toBeGreaterThanOrEqual(6);
  });

  it('should use QuickActionCard for quick actions (Manage Users + Manage Templates)', async () => {
    const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
    render(<AdminDashboard data={emptyData} />);
    const cards = screen.getAllByTestId('quick-action-card');
    expect(cards.length).toBe(2);
    expect(cards[0]).toHaveAttribute('href', '/admin/users');
    expect(cards[1]).toHaveAttribute('href', '/admin/templates');
  });

  describe('AdminDashboard - i18n empty-state description (UX-13)', () => {
    it('renders t("adminDashboard.noRecentActivityDescription") as empty-state description', async () => {
      const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
      render(<AdminDashboard data={emptyData} />);
      expect(screen.getByText('adminDashboard.noRecentActivityDescription')).toBeDefined();
    });

    it('does not render hardcoded "No recent activity to display" string', async () => {
      const { AdminDashboard } = await import('@/components/dashboard/AdminDashboard');
      render(<AdminDashboard data={emptyData} />);
      expect(screen.queryByText('No recent activity to display')).toBeNull();
    });
  });
});
