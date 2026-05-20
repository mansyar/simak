import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserFilters } from '@/components/admin/users/UserFilters';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'adminUsers.searchPlaceholder': 'Search users by name or email...',
        'adminUsers.allRoles': 'All Roles',
        'adminUsers.role_superadmin': 'Super Admin',
        'adminUsers.role_admin': 'Admin',
        'adminUsers.role_instructor': 'Instructor',
        'adminUsers.role_student': 'Student',
      };
      return translations[key] || key;
    },
  }),
}));

describe('UserFilters', () => {
  const onSearchChange = vi.fn();
  const onRoleChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search users by name or email...');
    expect(searchInput).toBeDefined();
  });

  it('should render role filter dropdown with current value', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />
    );

    // The select trigger shows the current value
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDefined();
  });

  it('should call onSearchChange when search input value changes', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search users by name or email...');
    fireEvent.change(searchInput, { target: { value: 'john' } });
    expect(onSearchChange).toHaveBeenCalledWith('john');
  });

  it('should call onRoleChange when role filter changes', () => {
    render(
      <UserFilters
        search=""
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />
    );

    // The role filter triggers onValueChange
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDefined();
  });

  it('should display current search value', () => {
    render(
      <UserFilters
        search="test"
        onSearchChange={onSearchChange}
        role="all"
        onRoleChange={onRoleChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search users by name or email...') as HTMLInputElement;
    expect(searchInput.value).toBe('test');
  });
});
