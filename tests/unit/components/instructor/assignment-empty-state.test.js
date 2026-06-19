import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentEmptyState } from '@/components/instructor/assignments/AssignmentEmptyState';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'instructorAssignments.empty': 'No assignments found',
        'instructorAssignments.createPrompt': 'Create your first assignment',
      };
      return translations[key] || key;
    },
  }),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }) =>
    _jsx('button', { onClick: onClick, 'data-testid': 'create-btn', children: children }),
}));
describe('AssignmentEmptyState', () => {
  it('should render empty state message', () => {
    render(_jsx(AssignmentEmptyState, { onCreateNew: vi.fn() }));
    expect(screen.getByText('No assignments found')).toBeDefined();
  });
  it('should render create prompt message', () => {
    render(_jsx(AssignmentEmptyState, { onCreateNew: vi.fn() }));
    expect(screen.getByText('Create your first assignment')).toBeDefined();
  });
  it('should render create new button', () => {
    render(_jsx(AssignmentEmptyState, { onCreateNew: vi.fn() }));
    expect(screen.getByTestId('create-btn')).toBeDefined();
  });
  it('should call onCreateNew when button clicked', () => {
    const onCreateNew = vi.fn();
    render(_jsx(AssignmentEmptyState, { onCreateNew: onCreateNew }));
    screen.getByTestId('create-btn').click();
    expect(onCreateNew).toHaveBeenCalledOnce();
  });
});
