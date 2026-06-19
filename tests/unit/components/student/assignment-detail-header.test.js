import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key, params) => {
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
    render(_jsx(AssignmentDetailHeader, { detail: detail }));
    expect(screen.getByText('Thesis Assignment')).toBeDefined();
  });
  it('should render the description', () => {
    render(_jsx(AssignmentDetailHeader, { detail: detail }));
    expect(screen.getByText('Final thesis project for graduating students')).toBeDefined();
  });
  it('should render the instructor name', () => {
    render(_jsx(AssignmentDetailHeader, { detail: detail }));
    expect(screen.getByText('Dr. Smith')).toBeDefined();
  });
  it('should render the template type badge', () => {
    render(_jsx(AssignmentDetailHeader, { detail: detail }));
    expect(screen.getByText('Thesis')).toBeDefined();
  });
  it('should render template type using outline Badge variant', () => {
    render(_jsx(AssignmentDetailHeader, { detail: detail }));
    const badge = screen.getByText('Thesis');
    expect(badge.tagName).toBe('SPAN');
    // Should not have the old default variant class (bg-primary text-primary-foreground)
    expect(badge.className).not.toContain('bg-primary');
  });
  it('should render the deadline', () => {
    render(_jsx(AssignmentDetailHeader, { detail: detail }));
    expect(screen.getByText(/Jun/)).toBeDefined();
  });
});
