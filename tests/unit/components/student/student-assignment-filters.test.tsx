import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the useI18n hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

import { StudentAssignmentFilters } from '@/components/student/assignments/StudentAssignmentFilters';

describe('StudentAssignmentFilters', () => {
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

  it('should call onSearchChange when input changes', () => {
    const handleChange = vi.fn();
    render(<StudentAssignmentFilters search="" onSearchChange={handleChange} />);

    const input = screen.getByPlaceholderText('studentAssignments.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'capstone' } });
    expect(handleChange).toHaveBeenCalledWith('capstone');
  });
});
