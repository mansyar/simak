/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

const emptyData = {
  pendingReviewCount: 0,
  pendingReviewItems: [],
  recentSubmissions: [],
  assignments: [],
};

describe('InstructorDashboard component', () => {
  it('should render pending reviews section', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    render(<InstructorDashboard data={emptyData} />);
    const elements = screen.getAllByText((content) =>
      content.startsWith('instructorDashboard.pendingReviews'),
    );
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('should render recent submissions section', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    render(<InstructorDashboard data={emptyData} />);
    expect(screen.getByText('instructorDashboard.recentSubmissions')).toBeDefined();
  });

  it('should render assignment overview section', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    render(<InstructorDashboard data={emptyData} />);
    expect(screen.getByText('instructorDashboard.assignmentOverview')).toBeDefined();
  });

  it('should render quick actions section', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    render(<InstructorDashboard data={emptyData} />);
    expect(screen.getByText('instructorDashboard.quickActions')).toBeDefined();
  });

  it('should show error state when data has error', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    render(<InstructorDashboard data={{ error: 'Unauthorized' } as any} />);
    expect(screen.getByText('common.error')).toBeDefined();
  });

  it('should render pending review count in widget title', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    render(<InstructorDashboard data={{ ...emptyData, pendingReviewCount: 5 }} />);
    expect(
      screen.getByText(
        (content) =>
          content.startsWith('instructorDashboard.pendingReviews') && content.includes('5'),
      ),
    ).toBeDefined();
  });

  it('should render pending review items', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const dataWithItems = {
      ...emptyData,
      pendingReviewItems: [
        {
          submissionId: 1,
          checkpointName: 'Checkpoint 1',
          assignmentTitle: 'Assignment 1',
          studentName: 'John Doe',
          submittedAt: new Date().toISOString(),
          waitTimeDays: 1,
        },
      ],
    };
    render(<InstructorDashboard data={dataWithItems} />);
    expect(screen.getByText('John Doe')).toBeDefined();
  });

  it('should render recent submission items', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const dataWithSubs = {
      ...emptyData,
      recentSubmissions: [
        {
          submissionId: 1,
          studentName: 'Jane Smith',
          assignmentTitle: 'Assignment 2',
          checkpointName: 'Checkpoint 1',
          submittedAt: new Date().toISOString(),
          status: 'Submitted',
        },
      ],
    };
    render(<InstructorDashboard data={dataWithSubs} />);
    expect(screen.getByText('Jane Smith')).toBeDefined();
    expect(screen.getByText('studentAssignments.status.submitted')).toBeDefined();
  });

  it('should render assignment overview items', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const dataWithAssignments = {
      ...emptyData,
      assignments: [
        {
          id: 1,
          title: 'Thesis 2026',
          finalDeadline: null,
          studentCount: 5,
          pendingReviewCount: 2,
          overallProgressPercent: 60,
        },
      ],
    };
    render(<InstructorDashboard data={dataWithAssignments} />);
    expect(screen.getByText('Thesis 2026')).toBeDefined();
  });
});
