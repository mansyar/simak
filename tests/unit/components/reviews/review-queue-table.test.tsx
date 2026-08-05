import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ReviewQueueTable } from '@/components/reviews/ReviewQueueTable';
import type { ReviewQueueItemData } from '@/components/reviews/ReviewQueueItem';

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

describe('ReviewQueueTable', () => {
  const now = Date.now();
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);

  const items: ReviewQueueItemData[] = [
    {
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
    },
    {
      submissionId: 11,
      checkpointId: 101,
      checkpointName: 'Chapter 2',
      assignmentId: 1,
      assignmentTitle: 'Thesis 2026',
      studentId: 'student-2',
      studentName: 'Bob',
      fileName: 'chapter2.pdf',
      fileSize: 4096,
      version: 2,
      uploadedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
      checkpointState: 'under_review',
    },
  ];

  it('should render table headers', () => {
    render(<ReviewQueueTable data={items} />);
    expect(screen.getByText('instructorReviews.table.student')).toBeDefined();
    expect(screen.getByText('instructorReviews.table.assignment')).toBeDefined();
    expect(screen.getByText('instructorReviews.table.waitTime')).toBeDefined();
    expect(screen.getByText('instructorReviews.table.status')).toBeDefined();
  });

  it('should render student names', () => {
    render(<ReviewQueueTable data={items} />);
    const table = document.querySelector('table');
    expect(table).toBeDefined();
    expect(within(table as HTMLElement).getByText('Alice')).toBeDefined();
    expect(within(table as HTMLElement).getByText('Bob')).toBeDefined();
  });

  it('should render checkpoint names', () => {
    render(<ReviewQueueTable data={items} />);
    const table = document.querySelector('table');
    expect(table).toBeDefined();
    expect(within(table as HTMLElement).getByText('Chapter 1')).toBeDefined();
    expect(within(table as HTMLElement).getByText('Chapter 2')).toBeDefined();
  });

  it('should render assignment titles', () => {
    render(<ReviewQueueTable data={items} />);
    const table = document.querySelector('table');
    expect(table).toBeDefined();
    expect(within(table as HTMLElement).getAllByText('Thesis 2026').length).toBe(2);
  });

  it('should render wait times', () => {
    render(<ReviewQueueTable data={items} />);
    const table = document.querySelector('table');
    expect(table).toBeDefined();
    expect(
      within(table as HTMLElement).getAllByText('instructorReviews.waitTime.daysHours').length,
    ).toBeGreaterThan(0);
  });

  it('should render SLA badges', () => {
    render(<ReviewQueueTable data={items} />);
    const table = document.querySelector('table');
    expect(table).toBeDefined();
    const badges = within(table as HTMLElement).getAllByTestId('sla-badge');
    expect(badges.length).toBe(2);
  });

  it('should render view links for each row', () => {
    render(<ReviewQueueTable data={items} />);
    const table = document.querySelector('table');
    expect(table).toBeDefined();
    const links = within(table as HTMLElement).getAllByTestId('review-queue-link');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toContain('/instructor/reviews/10');
    expect(links[1].getAttribute('href')).toContain('/instructor/reviews/11');
  });

  it('should render headers but no body rows when data is empty', () => {
    render(<ReviewQueueTable data={[]} />);
    expect(screen.getByText('instructorReviews.table.student')).toBeDefined();
    expect(screen.getByText('instructorReviews.table.assignment')).toBeDefined();
    expect(screen.getByText('instructorReviews.table.waitTime')).toBeDefined();
    expect(screen.getByText('instructorReviews.table.status')).toBeDefined();
    expect(screen.queryByTestId('review-queue-link')).toBeNull();
  });

  it('should expose table caption and scoped column headers', () => {
    render(<ReviewQueueTable data={items} />);

    expect(screen.getByText('instructorReviews.table.caption')).toBeDefined();
    const headers = Array.from(document.querySelectorAll('thead th'));
    expect(headers.length).toBeGreaterThan(0);
    expect(headers.every((header) => header.getAttribute('scope') === 'col')).toBe(true);
  });

  it('should provide a prioritized mobile review-card presentation', () => {
    render(<ReviewQueueTable data={items} />);

    expect(screen.getAllByTestId('review-queue-mobile-card')).toHaveLength(2);
  });
});
