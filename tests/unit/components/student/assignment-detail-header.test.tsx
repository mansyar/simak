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

import { AssignmentDetailHeader } from '@/components/student/assignments/AssignmentDetailHeader';

describe('AssignmentDetailHeader', () => {
  const detail = {
    title: 'Thesis Assignment',
    description: 'Final thesis project for graduating students',
    finalDeadline: new Date('2026-06-01'),
    effectiveDeadline: null as Date | null,
    instructorName: 'Dr. Smith',
    templateName: 'Thesis Template',
    templateType: 'Thesis',
  };

  it('should render the assignment title', () => {
    render(<AssignmentDetailHeader detail={detail} />);
    expect(screen.getByText('Thesis Assignment')).toBeDefined();
  });

  it('should render the description', () => {
    render(<AssignmentDetailHeader detail={detail} />);
    expect(screen.getByText('Final thesis project for graduating students')).toBeDefined();
  });

  it('should render the instructor name', () => {
    render(<AssignmentDetailHeader detail={detail} />);
    expect(screen.getByText('Dr. Smith')).toBeDefined();
  });

  it('should render the template type badge', () => {
    render(<AssignmentDetailHeader detail={detail} />);
    expect(screen.getByText('Thesis')).toBeDefined();
  });

  it('should render template type using outline Badge variant', () => {
    render(<AssignmentDetailHeader detail={detail} />);
    const badge = screen.getByText('Thesis');
    expect(badge.tagName).toBe('SPAN');
    // Should not have the old default variant class (bg-primary text-primary-foreground)
    expect(badge.className).not.toContain('bg-primary');
  });

  it('should render the deadline', () => {
    render(<AssignmentDetailHeader detail={detail} />);
    expect(screen.getByText(/Jun/)).toBeDefined();
  });

  it('should render effective deadline when present and not the final deadline', () => {
    render(
      <AssignmentDetailHeader detail={{ ...detail, effectiveDeadline: new Date('2026-07-15') }} />,
    );

    expect(screen.getByText(/studentAssignments\.effectiveDeadline/)).toBeDefined();
    expect(screen.queryByText(/studentAssignments\.finalDeadline/)).toBeNull();
  });

  it('should fall back to final deadline when effective deadline is null', () => {
    render(<AssignmentDetailHeader detail={detail} />);

    expect(screen.getByText(/studentAssignments\.finalDeadline/)).toBeDefined();
  });
});
