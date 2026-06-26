import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentCard } from '@/components/instructor/assignments/AssignmentCard';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'instructorAssignments.studentCount': '{count} Students',
        'instructorAssignments.finalDeadline': 'Deadline: {date}',
        'common.viewAll': 'View Details',
      };
      let text = translations[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, v);
        });
      }
      return text;
    },
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

describe('AssignmentCard', () => {
  const assignment = {
    id: 1,
    title: 'Final Thesis Project',
    description: 'This is the description for the final thesis project.',
    finalDeadline: '2026-12-31T00:00:00.000Z',
    createdAt: '2026-05-01T00:00:00.000Z',
    templateName: 'Thesis Template',
    templateType: 'Thesis',
    studentCount: 15,
  };

  it('should render assignment card metadata', () => {
    render(<AssignmentCard assignment={assignment} />);
    expect(screen.getByText('Final Thesis Project')).toBeDefined();
    expect(screen.getByText('This is the description for the final thesis project.')).toBeDefined();
    expect(screen.getByText('Thesis')).toBeDefined();
    expect(screen.getByText('Thesis Template')).toBeDefined();
    expect(screen.getByText('15 Students')).toBeDefined();
    expect(screen.getByText('Deadline: Dec 31, 2026')).toBeDefined();
    expect(screen.getByText('View Details →')).toBeDefined();
  });

  it('should omit description element if empty', () => {
    const noDesc = { ...assignment, description: null };
    render(<AssignmentCard assignment={noDesc} />);
    expect(screen.queryByText('This is the description for the final thesis project.')).toBeNull();
  });
});
