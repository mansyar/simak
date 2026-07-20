/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock the useI18n hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

import { StudentAssignmentFilters } from '@/components/student/assignments/StudentAssignmentFilters';

describe('StudentAssignmentFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render a search input', () => {
    const handleChange = vi.fn();
    render(<StudentAssignmentFilters search="" onSearchChange={handleChange} />);

    const input = screen.getByPlaceholderText('studentAssignments.searchPlaceholder');
    expect(input).toBeDefined();
  });

  it('should display the current search value', () => {
    const handleChange = vi.fn();
    render(<StudentAssignmentFilters search="thesis" onSearchChange={handleChange} />);

    const input = screen.getByPlaceholderText(
      'studentAssignments.searchPlaceholder',
    ) as HTMLInputElement;
    expect(input.value).toBe('thesis');
  });

  it('should debounce onSearchChange - rapid typing fires only 1 call after delay', () => {
    const handleChange = vi.fn();
    render(<StudentAssignmentFilters search="" onSearchChange={handleChange} />);

    const input = screen.getByPlaceholderText('studentAssignments.searchPlaceholder');

    const word = 'algorithm';
    for (let i = 1; i <= word.length; i++) {
      fireEvent.change(input, { target: { value: word.slice(0, i) } });
    }

    expect(handleChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('algorithm');
  });

  it('should show X clear button when search is not empty', () => {
    render(<StudentAssignmentFilters search="test" onSearchChange={vi.fn()} />);
    expect(screen.getByLabelText('common.clearSearch')).toBeDefined();
  });

  it('should hide X clear button when search is empty', () => {
    render(<StudentAssignmentFilters search="" onSearchChange={vi.fn()} />);
    expect(screen.queryByLabelText('common.clearSearch')).toBeNull();
  });

  it('should clear search immediately when X button is clicked', () => {
    const handleChange = vi.fn();
    render(<StudentAssignmentFilters search="test" onSearchChange={handleChange} />);

    fireEvent.click(screen.getByLabelText('common.clearSearch'));

    expect(handleChange).toHaveBeenCalledWith('');
  });
});
