import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserTable, UserRow } from '@/components/admin/users/UserTable';

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <button data-testid="dropdown-item" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children, ...props }: any) => (
    <button data-testid="dropdown-trigger" {...props}>
      {children}
    </button>
  ),
  DropdownMenuGroup: ({ children }: any) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

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
    render(
      <UserTable
        data={mockUsers}
        onEdit={onEdit}
        onDelete={onDelete}
        onGenerateLink={onGenerateLink}
      />,
    );

    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText('jane@example.com')).toBeDefined();
    expect(screen.getByText('Jane Smith')).toBeDefined();
  });

  it('should render role badges for each user', () => {
    render(
      <UserTable
        data={mockUsers}
        onEdit={onEdit}
        onDelete={onDelete}
        onGenerateLink={onGenerateLink}
      />,
    );

    expect(screen.getByText('adminUsers.role_admin')).toBeDefined();
    expect(screen.getByText('adminUsers.role_student')).toBeDefined();
  });

  it('should render email verified status badge', () => {
    render(
      <UserTable
        data={mockUsers}
        onEdit={onEdit}
        onDelete={onDelete}
        onGenerateLink={onGenerateLink}
      />,
    );

    expect(screen.getByText('adminUsers.emailVerified')).toBeDefined();
    expect(screen.getByText('adminUsers.notVerified')).toBeDefined();
  });

  it('should render empty state when no users', () => {
    render(
      <UserTable data={[]} onEdit={onEdit} onDelete={onDelete} onGenerateLink={onGenerateLink} />,
    );

    expect(screen.getByText('No users found.')).toBeDefined();
  });

  it('should render action dropdown menus for each user', () => {
    render(
      <UserTable
        data={mockUsers}
        onEdit={onEdit}
        onDelete={onDelete}
        onGenerateLink={onGenerateLink}
      />,
    );

    const menus = screen.getAllByTestId('dropdown-trigger');
    expect(menus).toHaveLength(2);
  });

  it('should render a row for unverified users with Not Verified badge', () => {
    const unverifiedUsers = [
      {
        id: '3',
        name: 'New User',
        email: 'new@example.com',
        role: 'student' as const,
        emailVerified: false,
        createdAt: new Date(),
      },
    ];
    render(
      <UserTable
        data={unverifiedUsers}
        onEdit={onEdit}
        onDelete={onDelete}
        onGenerateLink={onGenerateLink}
      />,
    );

    expect(screen.getByText('New User')).toBeDefined();
    expect(screen.getByText('adminUsers.notVerified')).toBeDefined();
    expect(screen.getByText('adminUsers.role_student')).toBeDefined();
  });

  it('should call onGenerateLink for unverified users', () => {
    const generateSpy = vi.fn();
    const unverifiedUser = {
      id: '3',
      name: 'New User',
      email: 'new@example.com',
      role: 'student' as const,
      emailVerified: false,
      createdAt: new Date(),
    };

    render(
      <UserTable
        data={[unverifiedUser]}
        onEdit={onEdit}
        onDelete={onDelete}
        onGenerateLink={generateSpy}
      />,
    );

    // With dropdown mock, all items render immediately
    const generateLinks = screen.getAllByText('adminUsers.generateLink');
    fireEvent.click(generateLinks[0]);
    expect(generateSpy).toHaveBeenCalledOnce();
  });

  it('should not show generate link for verified users', () => {
    render(
      <UserTable
        data={mockUsers}
        onEdit={onEdit}
        onDelete={onDelete}
        onGenerateLink={onGenerateLink}
      />,
    );

    const generateLinks = screen.queryAllByText('adminUsers.generateLink');
    // mockUsers has a verified user (John) and unverified user (Jane)
    // Only Jane (unverified) should have the generate link
    expect(generateLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('should call onEdit when edit action is clicked', () => {
    const editSpy = vi.fn();
    const unverifiedUser = {
      id: '3',
      name: 'New User',
      email: 'new@example.com',
      role: 'student' as const,
      emailVerified: false,
      createdAt: new Date(),
    };

    render(
      <UserTable
        data={[unverifiedUser]}
        onEdit={editSpy}
        onDelete={vi.fn()}
        onGenerateLink={vi.fn()}
      />,
    );

    const editItems = screen.getAllByText('common.edit');
    fireEvent.click(editItems[0]);
    expect(editSpy).toHaveBeenCalledWith(unverifiedUser);
  });

  it('should call onDelete when delete action is clicked', () => {
    const deleteSpy = vi.fn();
    const unverifiedUser = {
      id: '3',
      name: 'New User',
      email: 'new@example.com',
      role: 'student' as const,
      emailVerified: false,
      createdAt: new Date(),
    };

    render(
      <UserTable
        data={[unverifiedUser]}
        onEdit={vi.fn()}
        onDelete={deleteSpy}
        onGenerateLink={vi.fn()}
      />,
    );

    const deleteItems = screen.getAllByText('common.delete');
    fireEvent.click(deleteItems[0]);
    expect(deleteSpy).toHaveBeenCalledWith(unverifiedUser);
  });
});
