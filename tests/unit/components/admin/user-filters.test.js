import { jsx as _jsx, Fragment as _Fragment } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserFilters } from '@/components/admin/users/UserFilters';
vi.mock('@/components/ui/input', () => ({
  Input: (props) => _jsx('input', { 'data-testid': 'search-input', ...props }),
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }) =>
    _jsx('select', {
      'data-testid': 'role-select',
      value: value,
      onChange: (e) => onValueChange?.(e.target.value),
      children: children,
    }),
  SelectContent: ({ children }) => _jsx(_Fragment, { children: children }),
  SelectItem: ({ value, children }) => _jsx('option', { value: value, children: children }),
  SelectTrigger: ({ children }) => _jsx('div', { children: children }),
  SelectValue: ({ placeholder }) => _jsx('span', { children: placeholder }),
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
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
      _jsx(UserFilters, {
        search: '',
        onSearchChange: onSearchChange,
        role: 'all',
        onRoleChange: onRoleChange,
      }),
    );
    const searchInput = screen.getByPlaceholderText('Search users by name or email...');
    expect(searchInput).toBeDefined();
  });
  it('should render role filter select', () => {
    render(
      _jsx(UserFilters, {
        search: '',
        onSearchChange: onSearchChange,
        role: 'all',
        onRoleChange: onRoleChange,
      }),
    );
    expect(screen.getByTestId('role-select')).toBeDefined();
  });
  it('should call onSearchChange when search input value changes', () => {
    render(
      _jsx(UserFilters, {
        search: '',
        onSearchChange: onSearchChange,
        role: 'all',
        onRoleChange: onRoleChange,
      }),
    );
    const searchInput = screen.getByPlaceholderText('Search users by name or email...');
    fireEvent.change(searchInput, { target: { value: 'john' } });
    expect(onSearchChange).toHaveBeenCalledWith('john');
  });
  it('should call onRoleChange when role filter select changes', () => {
    const roleChangeSpy = vi.fn();
    render(
      _jsx(UserFilters, {
        search: '',
        onSearchChange: onSearchChange,
        role: 'all',
        onRoleChange: roleChangeSpy,
      }),
    );
    const select = screen.getByTestId('role-select');
    fireEvent.change(select, { target: { value: 'admin' } });
    expect(roleChangeSpy).toHaveBeenCalled();
  });
  it('should display selected role label when role is set', () => {
    render(
      _jsx(UserFilters, {
        search: '',
        onSearchChange: onSearchChange,
        role: 'admin',
        onRoleChange: onRoleChange,
      }),
    );
    const select = screen.getByTestId('role-select');
    expect(select.value).toBe('admin');
  });
  it('should display current search value', () => {
    render(
      _jsx(UserFilters, {
        search: 'test',
        onSearchChange: onSearchChange,
        role: 'all',
        onRoleChange: onRoleChange,
      }),
    );
    const searchInput = screen.getByPlaceholderText('Search users by name or email...');
    expect(searchInput.value).toBe('test');
  });
});
