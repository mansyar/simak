import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserFilters } from '@/components/admin/users/UserFilters';

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
