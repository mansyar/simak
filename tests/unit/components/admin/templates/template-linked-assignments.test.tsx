/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en' as const,
    setLocale: vi.fn(),
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/list-row', () => ({
  ListRow: ({ left, right }: any) => (
    <div data-testid="list-row">
      <div data-testid="list-row-left">{left}</div>
      {right && <div data-testid="list-row-right">{right}</div>}
    </div>
  ),
}));

const assignments = [
  {
    id: 1,
    title: 'Assignment 1',
    instructorName: 'Dr. Smith',
    studentCount: 5,
    createdAt: new Date('2026-01-15'),
  },
  {
    id: 2,
    title: 'Assignment 2',
    instructorName: 'Dr. Jones',
    studentCount: 3,
    createdAt: new Date('2026-02-10'),
  },
];

describe('TemplateLinkedAssignments', () => {
  it('should render assignments using ListRow primitive', async () => {
    const { TemplateLinkedAssignments } =
      await import('@/components/admin/templates/TemplateLinkedAssignments');
    render(<TemplateLinkedAssignments assignments={assignments} />);
    expect(screen.getAllByTestId('list-row')).toHaveLength(2);
    expect(screen.getByText('Assignment 1')).toBeInTheDocument();
    expect(screen.getByText('Assignment 2')).toBeInTheDocument();
  });

  it('should render no-assignments message when empty', async () => {
    const { TemplateLinkedAssignments } =
      await import('@/components/admin/templates/TemplateLinkedAssignments');
    render(<TemplateLinkedAssignments assignments={[]} />);
    expect(screen.getByText('adminTemplates.detail.noAssignments')).toBeInTheDocument();
  });

  it('should render instructor names', async () => {
    const { TemplateLinkedAssignments } =
      await import('@/components/admin/templates/TemplateLinkedAssignments');
    render(<TemplateLinkedAssignments assignments={assignments} />);
    expect(screen.getByText(/Dr\. Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Jones/)).toBeInTheDocument();
  });
});
