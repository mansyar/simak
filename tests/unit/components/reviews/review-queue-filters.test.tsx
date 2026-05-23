import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewQueueFilters } from '@/components/reviews/ReviewQueueFilters';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const assignments = [
  { id: 1, title: 'Thesis 2026' },
  { id: 2, title: 'Research Paper' },
];

describe('ReviewQueueFilters', () => {
  it('should render all assignments option', () => {
    render(
      <ReviewQueueFilters
        assignments={assignments}
        selectedAssignmentId={null}
        onAssignmentChange={() => {}}
      />,
    );
    expect(screen.getByText('instructorReviews.allAssignments')).toBeDefined();
  });

  it('should render assignment options', () => {
    render(
      <ReviewQueueFilters
        assignments={assignments}
        selectedAssignmentId={null}
        onAssignmentChange={() => {}}
      />,
    );
    expect(screen.getByText('Thesis 2026')).toBeDefined();
    expect(screen.getByText('Research Paper')).toBeDefined();
  });

  it('should call onAssignmentChange with selected id', () => {
    const onAssignmentChange = vi.fn();
    render(
      <ReviewQueueFilters
        assignments={assignments}
        selectedAssignmentId={null}
        onAssignmentChange={onAssignmentChange}
      />,
    );
    const select = screen.getByTestId('assignment-filter');
    fireEvent.change(select, { target: { value: '1' } });
    expect(onAssignmentChange).toHaveBeenCalledWith(1);
  });

  it('should call onAssignmentChange with null for default option', () => {
    const onAssignmentChange = vi.fn();
    render(
      <ReviewQueueFilters
        assignments={assignments}
        selectedAssignmentId={1}
        onAssignmentChange={onAssignmentChange}
      />,
    );
    const select = screen.getByTestId('assignment-filter');
    fireEvent.change(select, { target: { value: '' } });
    expect(onAssignmentChange).toHaveBeenCalledWith(null);
  });

  it('should show selected assignment value', () => {
    render(
      <ReviewQueueFilters
        assignments={assignments}
        selectedAssignmentId={1}
        onAssignmentChange={() => {}}
      />,
    );
    const select = screen.getByTestId('assignment-filter') as HTMLSelectElement;
    expect(select.value).toBe('1');
  });

  it('should show empty string when no assignment selected', () => {
    render(
      <ReviewQueueFilters
        assignments={assignments}
        selectedAssignmentId={null}
        onAssignmentChange={() => {}}
      />,
    );
    const select = screen.getByTestId('assignment-filter') as HTMLSelectElement;
    expect(select.value).toBe('');
  });
});
