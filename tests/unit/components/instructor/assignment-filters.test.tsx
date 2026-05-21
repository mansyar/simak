import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignmentFilters } from '@/components/instructor/assignments/AssignmentFilters';

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="search-input" {...props} />,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'instructorAssignments.searchPlaceholder': 'Search assignments by title...',
      };
      return translations[key] || key;
    },
  }),
}));

describe('AssignmentFilters', () => {
  const onSearchChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input', () => {
    render(<AssignmentFilters search="" onSearchChange={onSearchChange} />);
    const searchInput = screen.getByPlaceholderText('Search assignments by title...');
    expect(searchInput).toBeDefined();
  });

  it('should call onSearchChange when search input value changes', () => {
    render(<AssignmentFilters search="" onSearchChange={onSearchChange} />);
    const searchInput = screen.getByPlaceholderText('Search assignments by title...');
    fireEvent.change(searchInput, { target: { value: 'midterm' } });
    expect(onSearchChange).toHaveBeenCalledWith('midterm');
  });

  it('should display current search value', () => {
    render(<AssignmentFilters search="final" onSearchChange={onSearchChange} />);
    const searchInput = screen.getByPlaceholderText(
      'Search assignments by title...',
    ) as HTMLInputElement;
    expect(searchInput.value).toBe('final');
  });
});
