import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UserFilters } from '@/components/admin/users/UserFilters';
import { ROLES } from '@/lib/admin/roles';

vi.mock('@/lib/admin/roles', () => ({
  ROLES: [
    { value: 'admin', labelKey: 'adminUsers.role_admin_custom', badgeVariant: 'destructive' },
    {
      value: 'instructor',
      labelKey: 'adminUsers.role_instructor_custom',
      badgeVariant: 'destructive',
    },
    { value: 'student', labelKey: 'adminUsers.role_student_custom', badgeVariant: 'destructive' },
  ],
  getRoleConfig: vi.fn(),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="search-input" {...props} />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <select
      data-testid="role-select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => (
    <span data-testid="select-value-component">{placeholder}</span>
  ),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'adminUsers.searchPlaceholder': 'Search users by name or email...',
        'adminUsers.searchLabel': 'Search users',
        'adminUsers.allRoles': 'All Roles',
        'adminUsers.role_superadmin': 'Super Admin',
        'adminUsers.role_admin': 'Admin',
        'adminUsers.role_instructor': 'Instructor',
        'adminUsers.role_student': 'Student',
        'common.clearSearch': 'Clear search',
      };
      return translations[key] || key;
    },
  }),
}));

describe('UserFilters', () => {
  const onSearchChange = vi.fn();
  const onRoleChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render search input', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Search users by name or email...');
    expect(searchInput).toBeDefined();
  });

  it('should expose a labeled search input and a touch-safe clear control', () => {
    render(
      <UserFilters
        search="test"
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Search users' })).toBeDefined();
    const clearButton = screen.getByRole('button', { name: 'Clear search' });
    expect(clearButton.className).toMatch(/min-h-11/);
    expect(clearButton.className).toMatch(/min-w-11/);
    expect(clearButton.className).toMatch(/focus-visible/);
  });

  it('should render role filter select', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />,
    );

    expect(screen.getByTestId('role-select')).toBeDefined();
  });

  it('should debounce onSearchChange - rapid typing fires only 1 call after delay', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Search users by name or email...');

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

  it('should call onRoleChange when role filter select changes', () => {
    const roleChangeSpy = vi.fn();
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={roleChangeSpy}
      />,
    );

    const select = screen.getByTestId('role-select');
    fireEvent.change(select, { target: { value: 'admin' } });
    expect(roleChangeSpy).toHaveBeenCalled();
  });

  it('should display selected role label when role is set', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="admin"
        onRoleChange={onRoleChange}
      />,
    );

    const select = screen.getByTestId('role-select') as HTMLSelectElement;
    expect(select.value).toBe('admin');
  });

  it('should display current search value', () => {
    render(
      <UserFilters
        search="test"
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      'Search users by name or email...',
    ) as HTMLInputElement;
    expect(searchInput.value).toBe('test');
  });

  it('should use SelectValue component for display (data-testid="select-value-component")', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />,
    );
    expect(screen.getByTestId('select-value-component')).toBeDefined();
  });

  it('should use ROLES config for role filter options', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />,
    );
    expect(screen.getByText('adminUsers.role_admin_custom')).toBeDefined();
    expect(screen.queryByText('adminUsers.role_admin')).toBeNull();
  });

  it('should show X clear button when search is not empty', () => {
    render(
      <UserFilters
        search="test"
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />,
    );
    expect(screen.getByLabelText('Clear search')).toBeDefined();
  });

  it('should hide X clear button when search is empty', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />,
    );
    expect(screen.queryByLabelText('Clear search')).toBeNull();
  });

  it('should clear search immediately when X button is clicked', () => {
    render(
      <UserFilters
        search="test"
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Clear search'));

    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
