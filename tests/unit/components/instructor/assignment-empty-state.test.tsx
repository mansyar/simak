import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentEmptyState } from '@/components/instructor/assignments/AssignmentEmptyState';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'instructorAssignments.empty': 'No assignments found',
        'instructorAssignments.createPrompt': 'Create your first assignment',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick} data-testid="create-btn">
      {children}
    </button>
  ),
}));

describe('AssignmentEmptyState', () => {
  it('should render empty state message', () => {
    render(<AssignmentEmptyState onCreateNew={vi.fn()} />);
    expect(screen.getByText('No assignments found')).toBeDefined();
  });

  it('should render create prompt message', () => {
    render(<AssignmentEmptyState onCreateNew={vi.fn()} />);
    expect(screen.getByText('Create your first assignment')).toBeDefined();
  });

  it('should render create new button', () => {
    render(<AssignmentEmptyState onCreateNew={vi.fn()} />);
    expect(screen.getByTestId('create-btn')).toBeDefined();
  });

  it('should call onCreateNew when button clicked', () => {
    const onCreateNew = vi.fn();
    render(<AssignmentEmptyState onCreateNew={onCreateNew} />);
    screen.getByTestId('create-btn').click();
    expect(onCreateNew).toHaveBeenCalledOnce();
  });
});
