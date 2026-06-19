import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewQueueItem } from '@/components/reviews/ReviewQueueItem';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));
function MockLink({ children, to, params, ...props }) {
  let href = to;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      href = href.replace(`$${key}`, String(value));
    }
  }
  return _jsx('a', { href: href, ...props, children: children });
}
vi.mock('@tanstack/react-router', () => ({
  Link: MockLink,
}));
describe('ReviewQueueItem', () => {
  const now = Date.now();
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
  const item = {
    submissionId: 10,
    checkpointId: 100,
    checkpointName: 'Chapter 1',
    assignmentId: 1,
    assignmentTitle: 'Thesis 2026',
    studentId: 'student-1',
    studentName: 'Alice',
    fileName: 'chapter1.pdf',
    fileSize: 2048,
    version: 1,
    uploadedAt: threeDaysAgo,
    checkpointState: 'submitted',
  };
  it('should render student name', () => {
    render(_jsx(ReviewQueueItem, { item: item }));
    expect(screen.getByText('Alice')).toBeDefined();
  });
  it('should render checkpoint name', () => {
    render(_jsx(ReviewQueueItem, { item: item }));
    expect(screen.getByText('Chapter 1')).toBeDefined();
  });
  it('should render assignment title', () => {
    render(_jsx(ReviewQueueItem, { item: item }));
    expect(screen.getByText('Thesis 2026')).toBeDefined();
  });
  it('should render wait time', () => {
    render(_jsx(ReviewQueueItem, { item: item }));
    expect(screen.getByText(/3d/)).toBeDefined();
  });
  it('should link to review detail page', () => {
    render(_jsx(ReviewQueueItem, { item: item }));
    const link = screen.getByText('common.viewAll').closest('a');
    expect(link?.getAttribute('href')).toContain('/instructor/reviews/10');
  });
  it('should render under_review state badge', () => {
    const underReview = { ...item, checkpointState: 'under_review' };
    render(_jsx(ReviewQueueItem, { item: underReview }));
    expect(screen.getByTestId('sla-badge')).toBeDefined();
  });
});
