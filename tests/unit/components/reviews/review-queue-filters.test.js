import { jsx as _jsx, Fragment as _Fragment } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewQueueFilters } from '@/components/reviews/ReviewQueueFilters';
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }) =>
    _jsx('select', {
      'data-testid': 'assignment-filter',
      value: value,
      onChange: (e) => onValueChange?.(e.target.value),
      children: children,
    }),
  SelectContent: ({ children }) => _jsx(_Fragment, { children: children }),
  SelectItem: ({ value, children }) => _jsx('option', { value: value, children: children }),
  SelectTrigger: ({ children }) => _jsx('div', { children: children }),
  SelectValue: ({ placeholder }) => _jsx('span', { children: placeholder }),
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));
const assignments = [
  { id: 1, title: 'Thesis 2026' },
  { id: 2, title: 'Research Paper' },
];
describe('ReviewQueueFilters', () => {
  it('should render all assignments option', () => {
    render(
      _jsx(ReviewQueueFilters, {
        assignments: assignments,
        selectedAssignmentId: null,
        onAssignmentChange: () => {},
      }),
    );
    expect(screen.getByText('instructorReviews.allAssignments')).toBeDefined();
  });
  it('should render assignment options', () => {
    render(
      _jsx(ReviewQueueFilters, {
        assignments: assignments,
        selectedAssignmentId: null,
        onAssignmentChange: () => {},
      }),
    );
    expect(screen.getByText('Thesis 2026')).toBeDefined();
    expect(screen.getByText('Research Paper')).toBeDefined();
  });
  it('should call onAssignmentChange with selected id', () => {
    const onAssignmentChange = vi.fn();
    render(
      _jsx(ReviewQueueFilters, {
        assignments: assignments,
        selectedAssignmentId: null,
        onAssignmentChange: onAssignmentChange,
      }),
    );
    const select = screen.getByTestId('assignment-filter');
    fireEvent.change(select, { target: { value: '1' } });
    expect(onAssignmentChange).toHaveBeenCalledWith(1);
  });
  it('should call onAssignmentChange with null for default option', () => {
    const onAssignmentChange = vi.fn();
    render(
      _jsx(ReviewQueueFilters, {
        assignments: assignments,
        selectedAssignmentId: 1,
        onAssignmentChange: onAssignmentChange,
      }),
    );
    const select = screen.getByTestId('assignment-filter');
    fireEvent.change(select, { target: { value: 'all' } });
    expect(onAssignmentChange).toHaveBeenCalledWith(null);
  });
  it('should show selected assignment value', () => {
    render(
      _jsx(ReviewQueueFilters, {
        assignments: assignments,
        selectedAssignmentId: 1,
        onAssignmentChange: () => {},
      }),
    );
    const select = screen.getByTestId('assignment-filter');
    expect(select.value).toBe('1');
  });
  it('should show all when no assignment selected', () => {
    render(
      _jsx(ReviewQueueFilters, {
        assignments: assignments,
        selectedAssignmentId: null,
        onAssignmentChange: () => {},
      }),
    );
    expect(screen.getByText('instructorReviews.allAssignments')).toBeDefined();
  });
});
