/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructorRiskHistoryTab } from '@/components/instructor/assignments/InstructorRiskHistoryTab';
import { listInstructorRiskHistory } from '@/server/risk-history';

vi.mock('@/server/risk-history', () => ({ listInstructorRiskHistory: vi.fn() }));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ locale: 'en', t: (key: string) => key }),
}));

const students = [
  { id: 'student-1', name: 'Alice' },
  { id: 'student-2', name: 'Bob' },
];

const history = {
  observations: [
    {
      id: 2,
      source: 'lifecycle_event',
      eventType: 'review_recorded',
      observedAt: new Date('2026-08-10T10:00:00.000Z'),
      algorithmVersion: 'risk-v1',
      riskLevel: 'medium',
      factors: [{ code: 'overdue', category: 'student_inaction', severity: 'high' }],
      explanationSnapshot: { version: 'v1' },
      checkpointId: 4,
      interventionId: null,
    },
    {
      id: 1,
      source: 'daily_snapshot',
      eventType: null,
      observedAt: new Date('2026-08-09T10:00:00.000Z'),
      algorithmVersion: 'risk-v1',
      riskLevel: 'low',
      factors: [],
      explanationSnapshot: { version: 'v1' },
      checkpointId: null,
      interventionId: null,
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  outcomes: {
    facts: {
      checkpointTotal: 4,
      checkpointPassed: 2,
      submissionCount: 3,
      reviewCount: 2,
      verifiedConsultationCount: 1,
    },
    interpretation: { academicProgress: 'in_progress', engagement: 'engaged' },
    interventionBasis: [
      {
        id: 5,
        actionType: 'consultation',
        status: 'monitoring',
        followUpDate: new Date('2026-08-15T00:00:00.000Z'),
        createdAt: new Date('2026-08-02T00:00:00.000Z'),
        updatedAt: new Date('2026-08-09T00:00:00.000Z'),
      },
    ],
  },
};

describe('InstructorRiskHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listInstructorRiskHistory).mockResolvedValue(history as never);
  });

  it('loads the selected student and presents facts separately from interpretation', async () => {
    render(<InstructorRiskHistoryTab assignmentId={12} students={students} />);

    expect(screen.getByText('riskHistory.loading')).toBeDefined();
    await screen.findByText('riskHistory.timeline.title');

    expect(listInstructorRiskHistory).toHaveBeenCalledWith({
      data: { assignmentId: 12, studentId: 'student-1', from: null, to: null, page: 1, limit: 20 },
    });
    expect(screen.getByText('riskHistory.outcomes.facts')).toBeDefined();
    expect(screen.getByText('riskHistory.outcomes.interpretation')).toBeDefined();
    expect(screen.getByText('riskHistory.interpretation.academic.in_progress')).toBeDefined();
    expect(screen.getByText('riskHistory.event.review_recorded')).toBeDefined();
  });

  it('refetches for student and date filters and exposes pagination', async () => {
    render(<InstructorRiskHistoryTab assignmentId={12} students={students} />);
    await screen.findByText('riskHistory.timeline.title');

    fireEvent.change(screen.getByLabelText('riskHistory.filters.student'), {
      target: { value: 'student-2' },
    });
    fireEvent.change(screen.getByLabelText('riskHistory.filters.from'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'riskHistory.filters.apply' }));

    await waitFor(() =>
      expect(listInstructorRiskHistory).toHaveBeenLastCalledWith({
        data: {
          assignmentId: 12,
          studentId: 'student-2',
          from: new Date('2026-08-01T00:00:00.000Z'),
          to: null,
          page: 1,
          limit: 20,
        },
      }),
    );
  });

  it('renders localized empty and retryable error states', async () => {
    vi.mocked(listInstructorRiskHistory)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ...history, observations: [], total: 0 } as never);

    render(<InstructorRiskHistoryTab assignmentId={12} students={students} />);
    expect(await screen.findByText('riskHistory.error.title')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(await screen.findByText('riskHistory.empty.title')).toBeDefined();
  });
});
