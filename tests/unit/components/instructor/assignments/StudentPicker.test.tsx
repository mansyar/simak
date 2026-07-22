/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { StudentPicker } from '@/components/instructor/assignments/StudentPicker';
import { userKeys } from '@/lib/query-keys';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      let result = key;
      if (params) {
        result = result.replace(/\{(\w+)\}/g, (_, p) => params[p] ?? `{${p}}`);
      }
      return result;
    },
    locale: 'en',
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const mockStudents = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com' },
];

const mockProps = {
  selectedStudentIds: [],
  onToggleStudent: vi.fn(),
  onSelectAll: vi.fn(),
  onDeselectAll: vi.fn(),
  errors: {},
};

describe('StudentPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue({
      data: { users: mockStudents },
      isLoading: false,
      isError: false,
    } as never);
  });

  it('loads students via useQuery with userKeys.list', () => {
    render(<StudentPicker {...mockProps} />);
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: userKeys.list({ page: 1, limit: 200, search: '', role: 'student' }),
      }),
    );
  });

  it('renders student cards when data is loaded', () => {
    render(<StudentPicker {...mockProps} />);
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
  });

  it('shows loading skeletons while loading', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as never);
    render(<StudentPicker {...mockProps} />);
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
  });

  it('fires toast.error on query error', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    render(<StudentPicker {...mockProps} />);
    expect(toast.error).toHaveBeenCalledWith('errors.fetchFailed');
  });

  it('filters students by search input', () => {
    render(<StudentPicker {...mockProps} />);
    const searchInput = screen.getByPlaceholderText('instructorAssignments.wizard.searchStudents');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
  });
});
