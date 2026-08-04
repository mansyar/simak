/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ComponentType } from 'react';

const mocks = vi.hoisted(() => ({
  loaderData: {
    id: 1,
    title: 'Test Assignment',
    description: 'Test description',
    finalDeadline: '2026-12-31T23:59:59.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    templateName: 'Template 1',
    templateType: 'milestone',
    instructorId: 'instructor-1',
    students: [
      {
        id: 'student-1',
        name: 'Alice',
        email: 'alice@test.com',
        passedCount: 1,
        totalCheckpointsCount: 2,
        progressPercent: 50,
        activeCheckpoint: { id: 2, name: 'Checkpoint 2', state: 'unlocked' },
        effectiveDeadline: null,
        checkpoints: [
          {
            id: 1,
            name: 'Checkpoint 1',
            order: 1,
            state: 'passed',
            studentId: 'student-1',
            dueDate: null,
            minConsultations: null,
          },
          {
            id: 2,
            name: 'Checkpoint 2',
            order: 2,
            state: 'unlocked',
            studentId: 'student-1',
            dueDate: null,
            minConsultations: null,
          },
        ],
      },
      {
        id: 'student-2',
        name: 'Bob',
        email: 'bob@test.com',
        passedCount: 0,
        totalCheckpointsCount: 1,
        progressPercent: 0,
        activeCheckpoint: { id: 3, name: 'Checkpoint 1', state: 'unlocked' },
        effectiveDeadline: null,
        checkpoints: [
          {
            id: 3,
            name: 'Checkpoint 1',
            order: 1,
            state: 'unlocked',
            studentId: 'student-2',
            dueDate: null,
            minConsultations: null,
          },
        ],
      },
    ],
  },
  discussionPanelCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useLoaderData: () => mocks.loaderData,
    useParams: () => ({ id: '1' }),
    useNavigate: () => vi.fn(),
  }),
  Link: ({ children }: any) => children,
  useMatchRoute: () => () => false,
}));

vi.mock('@/server/assignments', () => ({
  getAssignmentDetail: vi.fn(),
}));

vi.mock('@/server/analytics', () => ({
  exportStudentProgressCsv: vi.fn(),
  exportReviewHistoryCsv: vi.fn(),
}));

vi.mock('@/hooks/use-assignment-tabs', () => ({
  useAssignmentTabs: () => ({
    pendingConsultations: [],
    extensionRequests: [],
    pendingPage: 1,
    pendingTotal: 0,
    setPendingPage: vi.fn(),
    refreshPendingConsultations: vi.fn(),
    extensionsLoading: false,
    handleApproveExtension: vi.fn(),
    handleRejectExtension: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-csv-download', () => ({
  useCsvDownload: () => ({
    exportCsv: vi.fn(),
    isExporting: false,
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  buttonVariants: ({ variant, size }: any) => `button-variants-${variant}-${size}`,
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ children, title }: any) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      {children}
    </div>
  ),
}));

vi.mock('@/components/instructor/assignments/AssignmentDetailHeader', () => ({
  AssignmentDetailHeader: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

vi.mock('@/components/instructor/assignments/AssignmentOverviewTab', () => ({
  AssignmentOverviewTab: () => <div data-testid="overview-tab" />,
}));

vi.mock('@/components/instructor/assignments/AssignmentConsultationsTab', () => ({
  AssignmentConsultationsTab: () => <div data-testid="consultations-tab" />,
}));

vi.mock('@/components/instructor/assignments/AssignmentExtensionsTab', () => ({
  AssignmentExtensionsTab: () => <div data-testid="extensions-tab" />,
}));

vi.mock('@/components/instructor/assignments/AssignmentInterventionsTab', () => ({
  AssignmentInterventionsTab: () => <div data-testid="interventions-tab" />,
}));

vi.mock('@/components/instructor/assignments/AssignmentDetailTabs', () => ({
  AssignmentDetailTabs: ({ tabs, activeTab, onTabChange }: any) => (
    <div data-testid="assignment-detail-tabs">
      {tabs.map((tab: any) => (
        <button
          key={tab.id}
          data-testid={`tab-${tab.id}`}
          data-state={activeTab === tab.id ? 'active' : 'inactive'}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/components/discussions/discussion-panel', () => ({
  DiscussionPanel: (props: any) => {
    mocks.discussionPanelCalls.push(props);
    return <div data-testid={`discussion-panel-${props.checkpointId}`} />;
  },
}));

vi.mock('@/lib/errors', () => ({
  isServerError: () => false,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('lucide-react', () => ({
  FileX: () => null,
  Download: () => null,
}));

vi.mock('@/components/skeletons/assignment-detail-skeleton', () => ({
  AssignmentDetailSkeleton: () => null,
}));

import { Route } from '@/routes/_authenticated/instructor/assignments/$id';

const AssignmentDetailPage = (Route as any).component as ComponentType;

describe('AssignmentDetailPage - Discussions tab', () => {
  beforeEach(() => {
    cleanup();
    mocks.discussionPanelCalls = [];
  });

  it('should render Discussions tab in the tab list', () => {
    const { getByTestId } = render(<AssignmentDetailPage />);

    const discussionsTab = getByTestId('tab-discussions');
    expect(discussionsTab).toBeTruthy();
    expect(discussionsTab.textContent).toBe('discussions.title');
  });

  it('should render the Interventions tab and panel for instructors', () => {
    const { getByTestId } = render(<AssignmentDetailPage />);

    expect(getByTestId('tab-interventions')).toBeTruthy();
    fireEvent.click(getByTestId('tab-interventions'));
    expect(getByTestId('interventions-tab')).toBeTruthy();
  });

  it('should render one selected DiscussionPanel and disclose other threads on demand', () => {
    const { getByTestId } = render(<AssignmentDetailPage />);

    expect(mocks.discussionPanelCalls).toHaveLength(0);

    fireEvent.click(getByTestId('tab-discussions'));

    expect(mocks.discussionPanelCalls).toHaveLength(1);
    expect(mocks.discussionPanelCalls[0]).toEqual({
      checkpointId: 1,
      assignmentId: 1,
      instructorView: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Alice — Checkpoint 2' }));
    expect(mocks.discussionPanelCalls.at(-1)).toEqual({
      checkpointId: 2,
      assignmentId: 1,
      instructorView: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Bob — Checkpoint 1' }));
    expect(mocks.discussionPanelCalls.at(-1)).toEqual({
      checkpointId: 3,
      assignmentId: 1,
      instructorView: true,
    });
  });

  it('should show the selected student and checkpoint as the discussion heading', () => {
    const { getByTestId } = render(<AssignmentDetailPage />);

    fireEvent.click(getByTestId('tab-discussions'));

    expect(document.querySelector('h3')?.textContent).toBe('Alice — Checkpoint 1');

    fireEvent.click(screen.getByRole('button', { name: 'Bob — Checkpoint 1' }));
    expect(document.querySelector('h3')?.textContent).toBe('Bob — Checkpoint 1');
  });
});
