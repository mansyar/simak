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
        'instructorAssignments.searchLabel': 'Search assignments',
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

  it('should expose a label for the search input', () => {
    render(<AssignmentFilters search="" onSearchChange={onSearchChange} />);
    expect(screen.getByRole('textbox', { name: 'Search assignments' })).toBeDefined();
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
    const clearButton = screen.getByLabelText('Clear search');
    expect(clearButton).toBeDefined();
    expect(clearButton.className).toContain('min-h-11');
    expect(clearButton.className).toContain('min-w-11');
    expect(clearButton.className).toContain('focus-visible');
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
});
