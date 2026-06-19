import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignmentFilters } from '@/components/instructor/assignments/AssignmentFilters';
vi.mock('@/components/ui/input', () => ({
  Input: (props) => _jsx('input', { 'data-testid': 'search-input', ...props }),
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
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
    render(_jsx(AssignmentFilters, { search: '', onSearchChange: onSearchChange }));
    const searchInput = screen.getByPlaceholderText('Search assignments by title...');
    expect(searchInput).toBeDefined();
  });
  it('should call onSearchChange when search input value changes', () => {
    render(_jsx(AssignmentFilters, { search: '', onSearchChange: onSearchChange }));
    const searchInput = screen.getByPlaceholderText('Search assignments by title...');
    fireEvent.change(searchInput, { target: { value: 'midterm' } });
    expect(onSearchChange).toHaveBeenCalledWith('midterm');
  });
  it('should display current search value', () => {
    render(_jsx(AssignmentFilters, { search: 'final', onSearchChange: onSearchChange }));
    const searchInput = screen.getByPlaceholderText('Search assignments by title...');
    expect(searchInput.value).toBe('final');
  });
});
