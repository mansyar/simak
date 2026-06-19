import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SLABadge } from '@/components/reviews/SLABadge';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));
describe('SLABadge', () => {
  it('should show "Not reviewed" for submitted state (not yet opened)', () => {
    render(_jsx(SLABadge, { state: 'submitted', updatedAt: new Date() }));
    expect(screen.getByText('instructorReviews.slaNotReviewed')).toBeDefined();
  });
  it('should show on-time status for items within 2 days', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
    render(_jsx(SLABadge, { state: 'under_review', updatedAt: twoDaysAgo }));
    expect(screen.getByText('instructorReviews.slaOnTime')).toBeDefined();
  });
  it('should show approaching status for items between 2-3 days', () => {
    const twoAndHalfDaysAgo = new Date();
    twoAndHalfDaysAgo.setHours(twoAndHalfDaysAgo.getHours() - 60);
    render(_jsx(SLABadge, { state: 'under_review', updatedAt: twoAndHalfDaysAgo }));
    expect(screen.getByText('instructorReviews.slaApproaching')).toBeDefined();
  });
  it('should show breached status for items over 3 days', () => {
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    render(_jsx(SLABadge, { state: 'under_review', updatedAt: fourDaysAgo }));
    expect(screen.getByText('instructorReviews.slaBreached')).toBeDefined();
  });
});
