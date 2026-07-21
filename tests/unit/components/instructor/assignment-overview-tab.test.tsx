/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) return `${key} ${JSON.stringify(params)}`;
      return key;
    },
    locale: 'en',
  }),
}));

vi.mock('@/components/reviews/DeadlineManager', () => ({
  DeadlineManager: () => <div data-testid="deadline-manager" />,
}));

import { AssignmentOverviewTab } from '@/components/instructor/assignments/AssignmentOverviewTab';

const baseAssignment = {
  id: 1,
  title: 'Thesis Assignment',
  description: 'Final thesis project',
  finalDeadline: '2026-06-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  templateName: 'Thesis Template',
  templateType: 'thesis',
  instructorId: 'instructor-1',
  students: [
    {
      id: 'student-1',
      name: 'Alice Cooper',
      email: 'alice@test.com',
      progressPercent: 50,
      passedCount: 1,
      totalCheckpointsCount: 2,
      effectiveDeadline: '2026-07-15',
      activeCheckpoint: {
        id: 102,
        name: 'Draft Proposal',
        state: 'unlocked',
      },
      checkpoints: [],
    },
    {
      id: 'student-2',
      name: 'Bob Marley',
      email: 'bob@test.com',
      progressPercent: 100,
      passedCount: 2,
      totalCheckpointsCount: 2,
      effectiveDeadline: null,
      activeCheckpoint: null,
      checkpoints: [],
    },
  ],
};

describe('AssignmentOverviewTab', () => {
  it('should render course-wide final deadline metric', () => {
    render(<AssignmentOverviewTab assignment={baseAssignment} />);

    expect(screen.getByText('Jun 1, 2026')).toBeDefined();
  });

  it('should render effective deadline column header', () => {
    render(<AssignmentOverviewTab assignment={baseAssignment} />);

    expect(screen.getByText(/instructorAssignments\.table\.effectiveDeadline/)).toBeDefined();
  });

  it('should render student effective deadline when present', () => {
    render(<AssignmentOverviewTab assignment={baseAssignment} />);

    // Date appears in both desktop table and mobile card layout (UX-36)
    expect(screen.getAllByText('Jul 15, 2026').length).toBe(2);
  });

  it('should fall back to em dash when student effective deadline is null', () => {
    render(<AssignmentOverviewTab assignment={baseAssignment} />);

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
