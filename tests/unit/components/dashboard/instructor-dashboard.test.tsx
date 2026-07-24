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
  atRiskStudents: [],
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

  it('should render SLABadge with success variant for on-time reviews', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const dataWithItems = {
      ...emptyData,
      pendingReviewItems: [
        {
          submissionId: 1,
          checkpointName: 'Checkpoint 1',
          assignmentTitle: 'Assignment 1',
          studentName: 'John Doe',
          submittedAt: oneDayAgo.toISOString(),
        },
      ],
    };
    render(<InstructorDashboard data={dataWithItems} />);
    expect(screen.getByText('instructorReviews.slaOnTime')).toBeDefined();
  });

  it('should render SLABadge with warning variant for approaching SLA', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const twoAndHalfDaysAgo = new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000);
    const dataWithItems = {
      ...emptyData,
      pendingReviewItems: [
        {
          submissionId: 1,
          checkpointName: 'Checkpoint 1',
          assignmentTitle: 'Assignment 1',
          studentName: 'John Doe',
          submittedAt: twoAndHalfDaysAgo.toISOString(),
        },
      ],
    };
    render(<InstructorDashboard data={dataWithItems} />);
    expect(screen.getByText('instructorReviews.slaApproaching')).toBeDefined();
  });

  it('should render SLABadge with destructive variant for breached SLA', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const dataWithItems = {
      ...emptyData,
      pendingReviewItems: [
        {
          submissionId: 1,
          checkpointName: 'Checkpoint 1',
          assignmentTitle: 'Assignment 1',
          studentName: 'John Doe',
          submittedAt: fourDaysAgo.toISOString(),
        },
      ],
    };
    render(<InstructorDashboard data={dataWithItems} />);
    expect(screen.getByText('instructorReviews.slaBreached')).toBeDefined();
  });

  it('should render at-risk students section title', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    render(<InstructorDashboard data={emptyData} />);
    expect(screen.getByText('instructorDashboard.atRisk.title')).toBeDefined();
  });

  it('should show empty state when no at-risk students', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    render(<InstructorDashboard data={emptyData} />);
    expect(screen.getByText('instructorDashboard.atRisk.empty')).toBeDefined();
  });

  it('should render at-risk student name and assignment title', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const dataWithRisk = {
      ...emptyData,
      atRiskStudents: [
        {
          studentName: 'Alice Johnson',
          studentId: 'student-1',
          assignmentTitle: 'Thesis 2026',
          assignmentId: 1,
          riskLevel: 'high' as const,
          factors: [
            {
              type: 'overdue_checkpoint' as const,
              severity: 'high' as const,
              category: 'student_inaction' as const,
              checkpointId: 1,
              description: 'Overdue checkpoint',
            },
          ],
        },
      ],
    };
    render(<InstructorDashboard data={dataWithRisk} />);
    expect(screen.getByText('Alice Johnson')).toBeDefined();
    expect(screen.getByText('Thesis 2026')).toBeDefined();
  });

  it('should render risk level badge text for high risk', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const dataWithRisk = {
      ...emptyData,
      atRiskStudents: [
        {
          studentName: 'Alice',
          studentId: 'student-1',
          assignmentTitle: 'Thesis',
          assignmentId: 1,
          riskLevel: 'high' as const,
          factors: [],
        },
      ],
    };
    render(<InstructorDashboard data={dataWithRisk} />);
    expect(screen.getByText('instructorDashboard.atRisk.levels.high')).toBeDefined();
  });

  it('should render risk level badge text for medium risk', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const dataWithRisk = {
      ...emptyData,
      atRiskStudents: [
        {
          studentName: 'Bob',
          studentId: 'student-2',
          assignmentTitle: 'Project',
          assignmentId: 2,
          riskLevel: 'medium' as const,
          factors: [],
        },
      ],
    };
    render(<InstructorDashboard data={dataWithRisk} />);
    expect(screen.getByText('instructorDashboard.atRisk.levels.medium')).toBeDefined();
  });

  it('should render risk level badge text for low risk', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const dataWithRisk = {
      ...emptyData,
      atRiskStudents: [
        {
          studentName: 'Charlie',
          studentId: 'student-3',
          assignmentTitle: 'Essay',
          assignmentId: 3,
          riskLevel: 'low' as const,
          factors: [],
        },
      ],
    };
    render(<InstructorDashboard data={dataWithRisk} />);
    expect(screen.getByText('instructorDashboard.atRisk.levels.low')).toBeDefined();
  });

  it('should render factor descriptions for at-risk students', async () => {
    const { InstructorDashboard } = await import('@/components/dashboard/InstructorDashboard');
    const dataWithRisk = {
      ...emptyData,
      atRiskStudents: [
        {
          studentName: 'Alice',
          studentId: 'student-1',
          assignmentTitle: 'Thesis 2026',
          assignmentId: 1,
          riskLevel: 'high' as const,
          factors: [
            {
              type: 'overdue_checkpoint' as const,
              severity: 'high' as const,
              category: 'student_inaction' as const,
              checkpointId: 1,
              description: 'Checkpoint is overdue',
            },
            {
              type: 'insufficient_consultations' as const,
              severity: 'medium' as const,
              category: 'student_inaction' as const,
              checkpointId: 1,
              description: 'Not enough consultations',
            },
          ],
        },
      ],
    };
    render(<InstructorDashboard data={dataWithRisk} />);
    expect(screen.getByText('Checkpoint is overdue')).toBeDefined();
    expect(screen.getByText('Not enough consultations')).toBeDefined();
  });
});
