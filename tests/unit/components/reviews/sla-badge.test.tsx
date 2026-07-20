import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SLABadge } from '@/components/reviews/SLABadge';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en' as const,
  }),
}));

describe('SLABadge', () => {
  it('should show "Not reviewed" for submitted state (not yet opened)', () => {
    render(<SLABadge state="submitted" updatedAt={new Date()} />);
    expect(screen.getByText('instructorReviews.slaNotReviewed')).toBeDefined();
  });

  it('should show on-time status for items within 2 days', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
    render(<SLABadge state="under_review" updatedAt={twoDaysAgo} />);
    expect(screen.getByText('instructorReviews.slaOnTime')).toBeDefined();
  });

  it('should show approaching status for items between 2-3 days', () => {
    const twoAndHalfDaysAgo = new Date();
    twoAndHalfDaysAgo.setHours(twoAndHalfDaysAgo.getHours() - 60);
    render(<SLABadge state="under_review" updatedAt={twoAndHalfDaysAgo} />);
    expect(screen.getByText('instructorReviews.slaApproaching')).toBeDefined();
  });

  it('should show breached status for items over 3 days', () => {
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    render(<SLABadge state="under_review" updatedAt={fourDaysAgo} />);
    expect(screen.getByText('instructorReviews.slaBreached')).toBeDefined();
  });

  it('should have title attribute with relative time for under_review state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T12:00:00'));
    try {
      const updatedAt = new Date('2026-03-01T12:00:00'); // 4 days ago
      render(<SLABadge state="under_review" updatedAt={updatedAt} />);
      const badge = screen.getByTestId('sla-badge');
      expect(badge.getAttribute('title')).toBe('4 days ago');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should have title attribute with relative time for submitted state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T12:00:00'));
    try {
      const updatedAt = new Date('2026-03-05T10:00:00'); // about 2 hours ago
      render(<SLABadge state="submitted" updatedAt={updatedAt} />);
      const badge = screen.getByTestId('sla-badge');
      expect(badge.getAttribute('title')).toMatch(/2 hours ago/);
    } finally {
      vi.useRealTimers();
    }
  });
});
