import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewQueueItem } from '@/components/reviews/ReviewQueueItem';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

function MockLink({ children, to, params, ...props }: any) {
  let href = to;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      href = href.replace(`$${key}`, String(value));
    }
  }
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
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
    checkpointState: 'submitted' as const,
  };

  it('should render student name', () => {
    render(<ReviewQueueItem item={item} />);
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('should render checkpoint name', () => {
    render(<ReviewQueueItem item={item} />);
    expect(screen.getByText('Chapter 1')).toBeDefined();
  });

  it('should render assignment title', () => {
    render(<ReviewQueueItem item={item} />);
    expect(screen.getByText('Thesis 2026')).toBeDefined();
  });

  it('should render wait time', () => {
    render(<ReviewQueueItem item={item} />);
    expect(screen.getByText(/3d/)).toBeDefined();
  });

  it('should link to review detail page', () => {
    render(<ReviewQueueItem item={item} />);
    const link = screen.getByText('common.viewAll').closest('a');
    expect(link?.getAttribute('href')).toContain('/instructor/reviews/10');
  });

  it('should render under_review state badge', () => {
    const underReview = { ...item, checkpointState: 'under_review' as const };
    render(<ReviewQueueItem item={underReview} />);
    expect(screen.getByTestId('sla-badge')).toBeDefined();
  });
});
