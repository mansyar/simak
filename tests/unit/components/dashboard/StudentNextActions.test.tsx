/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StudentNextActionsResult, StudentNextAction } from '@/lib/student-next-actions';

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
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

const emptyWaiting = {
  submitted: { count: 0, representatives: [] },
  underReview: { count: 0, representatives: [] },
};

const action = (overrides: Partial<StudentNextAction> = {}): StudentNextAction => ({
  assignmentId: 1,
  assignmentTitle: 'Thesis',
  checkpointId: 10,
  checkpointName: 'Proposal',
  dueDate: new Date('2026-08-10T12:00:00Z'),
  kind: 'submit',
  priority: 'dated',
  submissionId: null,
  href: '/student/assignments/1/checkpoints/10',
  ...overrides,
});

describe('StudentNextActions', () => {
  it('always renders a positive empty state and waiting groups', async () => {
    const { StudentNextActions } = await import('@/components/dashboard/StudentNextActions');
    const data: StudentNextActionsResult = {
      primaryActions: [],
      waitingSummary: {
        submitted: {
          count: 1,
          representatives: [
            {
              assignmentId: 1,
              assignmentTitle: 'Thesis',
              checkpointId: 10,
              checkpointName: 'Proposal',
              dueDate: null,
              submissionId: 100,
              href: '/student/assignments/1/checkpoints/10',
            },
          ],
        },
        underReview: { count: 1, representatives: [] },
      },
    };

    render(<StudentNextActions data={data} />);

    expect(
      screen.getByRole('heading', { name: 'studentDashboard.nextActions.title' }),
    ).toBeDefined();
    expect(screen.getByText('studentDashboard.nextActions.empty')).toBeDefined();
    expect(screen.getByText('studentDashboard.nextActions.waiting.title')).toBeDefined();
    expect(screen.getByText('studentDashboard.nextActions.waiting.submitted')).toBeDefined();
    expect(screen.getByText('studentDashboard.nextActions.waiting.underReview')).toBeDefined();
    expect(screen.getAllByText('studentDashboard.nextActions.waiting.count')).toHaveLength(2);
    expect(
      screen
        .getByRole('link', { name: 'studentDashboard.nextActions.openWaitingCheckpoint' })
        .getAttribute('href'),
    ).toBe('/student/assignments/1/checkpoints/10');
    expect(
      screen
        .getByRole('link', { name: 'studentDashboard.nextActions.openWaitingCheckpoint' })
        .getAttribute('class'),
    ).toContain('focus-visible:ring-2');
  });

  it('renders one accessible link per primary action with precise destinations', async () => {
    const { StudentNextActions } = await import('@/components/dashboard/StudentNextActions');
    const data: StudentNextActionsResult = {
      primaryActions: [
        action({ kind: 'submit', checkpointId: 10 }),
        action({
          kind: 'revise',
          checkpointId: 11,
          checkpointName: 'Draft',
          priority: 'revise',
          href: '/student/assignments/1/checkpoints/11',
          revisionActionPlan: {
            unresolvedCount: 4,
            items: ['Rewrite the conclusion', 'Add evidence', 'Clarify method'],
          },
        }),
        action({
          kind: 'consultation',
          checkpointId: 12,
          checkpointName: 'Method',
          priority: 'consultation',
          href: '/student/assignments/1',
        }),
      ],
      waitingSummary: emptyWaiting,
    };

    render(<StudentNextActions data={data} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/student/assignments/1/checkpoints/10',
      '/student/assignments/1/checkpoints/11',
      '/student/assignments/1',
    ]);
    expect(screen.getByText('studentDashboard.nextActions.actions.submit')).toBeDefined();
    expect(screen.getByText('studentDashboard.nextActions.actions.revise')).toBeDefined();
    expect(screen.getByText('studentDashboard.nextActions.actions.consultation')).toBeDefined();
    expect(screen.getByText('Rewrite the conclusion')).toBeDefined();
    expect(screen.getByText('Add evidence')).toBeDefined();
    expect(screen.getByText('Clarify method')).toBeDefined();
    expect(screen.getByText('studentDashboard.nextActions.revisionPlan.remaining')).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'studentDashboard.nextActions.submitCheckpoint' }),
    ).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'studentDashboard.nextActions.reviseCheckpoint' }),
    ).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'studentDashboard.nextActions.requiredConsultation' }),
    ).toBeDefined();
    expect(screen.getByText('studentDashboard.nextActions.priority.revise')).toBeDefined();
    expect(screen.getByText('studentDashboard.nextActions.priority.consultation')).toBeDefined();
    expect(screen.getAllByText('studentDashboard.nextActions.due')).toHaveLength(3);
  });

  it('renders no more than three waiting representatives across both groups', async () => {
    const { StudentNextActions } = await import('@/components/dashboard/StudentNextActions');
    const representative = (checkpointId: number) => ({
      assignmentId: 1,
      assignmentTitle: 'Thesis',
      checkpointId,
      checkpointName: `Checkpoint ${checkpointId}`,
      dueDate: null,
      submissionId: checkpointId,
      href: `/student/assignments/1/checkpoints/${checkpointId}`,
    });
    const data: StudentNextActionsResult = {
      primaryActions: [],
      waitingSummary: {
        submitted: { count: 4, representatives: [representative(1), representative(2)] },
        underReview: { count: 4, representatives: [representative(3), representative(4)] },
      },
    };

    render(<StudentNextActions data={data} />);

    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('renders no more than five primary action cards', async () => {
    const { StudentNextActions } = await import('@/components/dashboard/StudentNextActions');
    const data: StudentNextActionsResult = {
      primaryActions: Array.from({ length: 6 }, (_, index) =>
        action({
          checkpointId: index + 1,
          checkpointName: `Checkpoint ${index + 1}`,
          href: `/student/assignments/1/checkpoints/${index + 1}`,
        }),
      ),
      waitingSummary: emptyWaiting,
    };

    render(<StudentNextActions data={data} />);

    expect(screen.getAllByRole('link')).toHaveLength(5);
  });
});
