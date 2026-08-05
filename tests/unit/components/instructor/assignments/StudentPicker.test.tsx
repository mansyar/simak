/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // `as never` bypasses useQuery's complex return type; mock provides only fields the component reads
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

  it('renders an inline retryable error state when students fail to load', () => {
    const refetch = vi.fn();
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network failure'),
      refetch,
    } as never);

    render(<StudentPicker {...mockProps} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('errors.fetchFailed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('exposes students as keyboard-operable checkbox options', () => {
    render(<StudentPicker {...mockProps} />);
    const option = screen.getByRole('checkbox', { name: /Alice Johnson/ });
    expect(option.getAttribute('aria-checked')).toBe('false');
    option.focus();
    expect(document.activeElement).toBe(option);
  });

  it('triggers onToggleStudent when a student card is clicked', () => {
    render(<StudentPicker {...mockProps} />);
    fireEvent.click(screen.getByText('Alice Johnson'));
    expect(mockProps.onToggleStudent).toHaveBeenCalledWith('1');
  });

  it('triggers onSelectAll with all student IDs when Select All is clicked', () => {
    render(<StudentPicker {...mockProps} />);
    fireEvent.click(screen.getByText('instructorAssignments.selectAll'));
    expect(mockProps.onSelectAll).toHaveBeenCalledWith(['1', '2', '3']);
  });

  it('renders validation error when errors.studentIds is present', () => {
    render(
      <StudentPicker {...mockProps} errors={{ studentIds: 'At least one student is required' }} />,
    );
    expect(screen.getByText('At least one student is required')).toBeInTheDocument();
  });

  it('filters students by search input', () => {
    render(<StudentPicker {...mockProps} />);
    const searchInput = screen.getByPlaceholderText('instructorAssignments.wizard.searchStudents');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
  });

  it('does not change the fixed server query when typing locally', () => {
    render(<StudentPicker {...mockProps} />);
    const searchInput = screen.getByPlaceholderText('instructorAssignments.wizard.searchStudents');

    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(useQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: userKeys.list({ page: 1, limit: 200, search: '', role: 'student' }),
      }),
    );
  });

  it('memoizes searchable student fields when selection changes', () => {
    let nameReads = 0;
    let emailReads = 0;
    const trackedStudents = [
      {
        id: '1',
        get name() {
          nameReads += 1;
          return 'Alice Johnson';
        },
        get email() {
          emailReads += 1;
          return 'alice@example.com';
        },
      },
    ];
    vi.mocked(useQuery).mockReturnValue({
      data: { users: trackedStudents },
      isLoading: false,
      isError: false,
    } as never);

    const { rerender } = render(<StudentPicker {...mockProps} />);
    const initialNameReads = nameReads;
    const initialEmailReads = emailReads;

    rerender(<StudentPicker {...mockProps} selectedStudentIds={['1']} />);

    expect(nameReads).toBe(initialNameReads + 2);
    expect(emailReads).toBe(initialEmailReads + 1);
  });
});
