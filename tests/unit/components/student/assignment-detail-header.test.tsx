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

  it('should render the deadline', () => {
    render(<AssignmentDetailHeader detail={detail} />);
    expect(screen.getByText(/Jun/)).toBeDefined();
  });
});
