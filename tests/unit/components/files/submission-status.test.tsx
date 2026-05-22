import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) return `${key} ${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

import { SubmissionStatus } from '@/components/files/submission-status';

describe('SubmissionStatus', () => {
  it('should show pass result when decision is pass', () => {
    render(
      <SubmissionStatus
        review={{
          decision: 'pass',
          comment: 'Great work!',
          reviewedAt: new Date('2026-05-20'),
        }}
      />,
    );
    expect(screen.getByText('files.review.passed')).toBeDefined();
    expect(screen.getByText('Great work!')).toBeDefined();
  });

  it('should show revise result with comment and deadline', () => {
    render(
      <SubmissionStatus
        review={{
          decision: 'revise',
          comment: 'Please improve chapter 2',
          revisionDeadline: new Date('2026-06-01'),
          reviewedAt: new Date('2026-05-20'),
        }}
      />,
    );
    expect(screen.getByText('files.review.revise')).toBeDefined();
    expect(screen.getByText('Please improve chapter 2')).toBeDefined();
    expect(screen.getByText(/files.revisionDeadline/)).toBeDefined();
  });

  it('should show awaiting review when no review exists', () => {
    render(<SubmissionStatus review={null} />);
    expect(screen.getByText('files.review.awaiting')).toBeDefined();
  });

  it('should show reviewer name when available', () => {
    render(
      <SubmissionStatus
        review={{
          decision: 'pass',
          comment: 'Approved',
          reviewerName: 'Dr. Smith',
          reviewedAt: new Date('2026-05-20'),
        }}
      />,
    );
    expect(screen.getByText(/Dr. Smith/)).toBeDefined();
  });
});
