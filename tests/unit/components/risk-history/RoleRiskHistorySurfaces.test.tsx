/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  trends: vi.fn(),
  support: vi.fn(),
}));

vi.mock('@/server/risk-history', () => ({
  getAdminRiskTrends: mocks.trends,
  getStudentSupportStatus: mocks.support,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('role-specific risk-history surfaces', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows only aggregate admin trends and suppresses small cohorts', async () => {
    mocks.trends.mockResolvedValue({
      suppressed: true,
      minimumCohortSize: 10,
      cohortSize: 7,
      trends: [],
    });
    const { AdminRiskTrendsPanel } = await import('@/components/admin/AdminRiskTrendsPanel');
    render(<AdminRiskTrendsPanel termId={1} from="2026-08-01" to="2026-08-10" />);

    expect(await screen.findByText('riskHistory.admin.suppressedTitle')).toBeDefined();
    expect(screen.getByText('riskHistory.admin.suppressedDescription')).toBeDefined();
    expect(screen.queryByText('7')).toBeNull();
    expect(mocks.trends).toHaveBeenCalledWith({
      data: { termId: 1, courseId: null, sectionId: null, from: '2026-08-01', to: '2026-08-10' },
    });
  });

  it('renders non-identifying aggregate rows without drill-down controls', async () => {
    mocks.trends.mockResolvedValue({
      suppressed: false,
      minimumCohortSize: 10,
      cohortSize: 12,
      trends: [{ date: '2026-08-10', riskLevel: 'medium', observationCount: 4 }],
    });
    const { AdminRiskTrendsPanel } = await import('@/components/admin/AdminRiskTrendsPanel');
    render(<AdminRiskTrendsPanel sectionId={3} from="2026-08-01" to="2026-08-10" />);

    expect(await screen.findByText('2026-08-10')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button', { name: /student/i })).toBeNull();
  });

  it('uses constructive student support language and approved next steps only', async () => {
    mocks.support.mockResolvedValue({
      status: 'support_available',
      nextSteps: ['contact_instructor', 'review_current_work'],
    });
    const { StudentSupportCard } =
      await import('@/components/student/assignments/StudentSupportCard');
    render(<StudentSupportCard assignmentId={42} />);

    expect(await screen.findByText('riskHistory.student.supportAvailableTitle')).toBeDefined();
    expect(screen.getByText('riskHistory.student.steps.contactInstructor')).toBeDefined();
    expect(screen.getByText('riskHistory.student.steps.reviewCurrentWork')).toBeDefined();
    expect(screen.queryByText(/score|factor|risk level|intervention/i)).toBeNull();
    expect(mocks.support).toHaveBeenCalledWith({ data: { assignmentId: 42 } });
  });

  it('renders on-track, loading, and retryable error states accessibly', async () => {
    let reject!: (error: Error) => void;
    mocks.support.mockImplementationOnce(
      () => new Promise((_resolve, rejectPromise) => (reject = rejectPromise)),
    );
    const { StudentSupportCard } =
      await import('@/components/student/assignments/StudentSupportCard');
    const view = render(<StudentSupportCard assignmentId={42} />);
    expect(screen.getByRole('status')).toBeDefined();
    reject(new Error('offline'));
    expect(await screen.findByRole('alert')).toBeDefined();

    mocks.support.mockResolvedValueOnce({ status: 'on_track', nextSteps: [] });
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => expect(screen.getByText('riskHistory.student.onTrackTitle')).toBeDefined());
    view.unmount();
  });
});
