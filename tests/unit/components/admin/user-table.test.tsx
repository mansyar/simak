import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserTable, UserRow } from '@/components/admin/users/UserTable';

// Mock useI18n
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'adminUsers.deleteConfirm') {
        return params ? `Are you sure you want to delete ${params.name}?` : key;
      }
      return key;
    },
  }),
}));

const mockUsers: UserRow[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    emailVerified: true,
    createdAt: new Date('2025-01-15'),
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'student',
    emailVerified: false,
    createdAt: new Date('2025-02-20'),
  },
];

describe('UserTable', () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onGenerateLink = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render table with user data', () => {
    render(<UserTable data={mockUsers} onEdit={onEdit} onDelete={onDelete} onGenerateLink={onGenerateLink} />);

    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText('jane@example.com')).toBeDefined();
    expect(screen.getByText('Jane Smith')).toBeDefined();
  });

  it('should render role badges for each user', () => {
    render(<UserTable data={mockUsers} onEdit={onEdit} onDelete={onDelete} onGenerateLink={onGenerateLink} />);

    expect(screen.getByText('adminUsers.role_admin')).toBeDefined();
    expect(screen.getByText('adminUsers.role_student')).toBeDefined();
  });

  it('should render email verified status badge', () => {
    render(<UserTable data={mockUsers} onEdit={onEdit} onDelete={onDelete} onGenerateLink={onGenerateLink} />);

    expect(screen.getByText('adminUsers.emailVerified')).toBeDefined();
    expect(screen.getByText('adminUsers.notVerified')).toBeDefined();
  });

  it('should render empty state when no users', () => {
    render(<UserTable data={[]} onEdit={onEdit} onDelete={onDelete} onGenerateLink={onGenerateLink} />);

    expect(screen.getByText('No users found.')).toBeDefined();
  });

  it('should render action dropdown menu for each user', () => {
    render(<UserTable data={mockUsers} onEdit={onEdit} onDelete={onDelete} onGenerateLink={onGenerateLink} />);

    const menus = screen.getAllByRole('button', { name: 'Open menu' });
    expect(menus).toHaveLength(2);
  });

  it('should render action menu trigger buttons', () => {
    render(<UserTable data={mockUsers} onEdit={onEdit} onDelete={onDelete} onGenerateLink={onGenerateLink} />);

    const menuTriggers = screen.getAllByRole('button', { name: 'Open menu' });
    expect(menuTriggers).toHaveLength(2);
  });
});
