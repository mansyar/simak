import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AssignmentFilters } from '@/components/instructor/assignments/AssignmentFilters';

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="search-input" {...props} />,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'instructorAssignments.searchPlaceholder': 'Search assignments by title...',
        'common.clearSearch': 'Clear search',
      };
      return translations[key] || key;
    },
  }),
}));

describe('AssignmentFilters', () => {
  const onSearchChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render search input', () => {
    render(<AssignmentFilters search="" onSearchChange={onSearchChange} />);
    const searchInput = screen.getByPlaceholderText('Search assignments by title...');
    expect(searchInput).toBeDefined();
  });

  it('should debounce onSearchChange - rapid typing fires only 1 call after delay', () => {
    render(<AssignmentFilters search="" onSearchChange={onSearchChange} />);
    const searchInput = screen.getByPlaceholderText('Search assignments by title...');

    const word = 'algorithm';
    for (let i = 1; i <= word.length; i++) {
      fireEvent.change(searchInput, { target: { value: word.slice(0, i) } });
    }

    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('algorithm');
  });

  it('should display current search value', () => {
    render(<AssignmentFilters search="final" onSearchChange={onSearchChange} />);
    const searchInput = screen.getByPlaceholderText(
      'Search assignments by title...',
    ) as HTMLInputElement;
    expect(searchInput.value).toBe('final');
  });

  it('should show X clear button when search is not empty', () => {
    render(<AssignmentFilters search="test" onSearchChange={onSearchChange} />);
    expect(screen.getByLabelText('Clear search')).toBeDefined();
  });

  it('should hide X clear button when search is empty', () => {
    render(<AssignmentFilters search="" onSearchChange={onSearchChange} />);
    expect(screen.queryByLabelText('Clear search')).toBeNull();
  });

  it('should clear search immediately when X button is clicked', () => {
    render(<AssignmentFilters search="test" onSearchChange={onSearchChange} />);

    fireEvent.click(screen.getByLabelText('Clear search'));

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('should cancel a pending search when the clear button is clicked', () => {
    render(<AssignmentFilters search="" onSearchChange={onSearchChange} />);
    const searchInput = screen.getByPlaceholderText('Search assignments by title...');

    fireEvent.change(searchInput, { target: { value: 'draft' } });
    fireEvent.click(screen.getByLabelText('Clear search'));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
