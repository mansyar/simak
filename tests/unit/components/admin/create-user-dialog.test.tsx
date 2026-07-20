import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { CreateUserDialog } from '@/components/admin/users/CreateUserDialog';
import { CreateUserSchema } from '@/server/users';
import { ROLES } from '@/lib/admin/roles';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

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

// Mock react-hook-form to bypass validation and submit with mock values
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn(),
    handleSubmit: (fn: any) => (e?: any) => {
      if (e?.preventDefault) e.preventDefault();
      return Promise.resolve(fn({ name: 'Test User', email: 'test@example.com', role: 'student' }));
    },
    watch: () => ({}),
    getValues: () => ({}),
    setValue: vi.fn(),
    reset: vi.fn(),
    formState: { errors: {}, isSubmitting: false },
  }),
  Controller: ({ render, name }: any) => render({ field: { value: '', onChange: vi.fn(), name } }),
  FormProvider: ({ children }: any) => <div>{children}</div>,
  useFormContext: () => ({
    register: vi.fn(),
    handleSubmit: (fn: any) => (e?: any) => {
      if (e?.preventDefault) e.preventDefault();
      return Promise.resolve(fn({ name: 'Test User', email: 'test@example.com', role: 'student' }));
    },
    watch: () => ({}),
    getValues: () => ({}),
    setValue: vi.fn(),
    reset: vi.fn(),
    formState: { errors: {}, isSubmitting: false },
  }),
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

// Mock the UI components that have complex dependencies
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-desc">{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
}));

vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: { children: React.ReactNode }) => <div data-testid="form">{children}</div>,
  FormControl: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-control">{children}</div>
  ),
  FormField: ({ render, name }: { render: any; name: string }) => {
    const fieldValues: Record<string, string> = {
      name: 'Test User',
      email: 'test@example.com',
      role: 'student',
      checkpoints: '',
    };
    return (
      <div data-testid="form-field" data-field-name={name}>
        {render
          ? render({ field: { value: fieldValues[name] || '', onChange: () => {}, name } })
          : null}
      </div>
    );
  },
  FormItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-item">{children}</div>
  ),
  FormLabel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-label">{children}</div>
  ),
  FormMessage: () => <div data-testid="form-message" />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <select data-testid="role-select" onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => (
    <span data-testid="select-value-component">{placeholder}</span>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => (
    <input data-testid={`input-${props.name || props.placeholder}`} {...props} />
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, loading, ...props }: any) => (
    <button type={type} data-testid="submit-btn" disabled={loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

// Mock useI18n
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'adminUsers.newUser': 'New User',
        'adminUsers.createPrompt': 'Create your first user',
        'adminUsers.table.name': 'Name',
        'adminUsers.table.role': 'Role',
        'adminUsers.role_admin': 'Admin',
        'adminUsers.role_instructor': 'Instructor',
        'adminUsers.role_student': 'Student',
        'auth.email': 'Email',
        'common.create': 'Create',
        'common.error': 'Error',
        'adminUsers.createSuccess': 'User created successfully',
      };
      return translations[key] || key;
    },
  }),
}));

describe('CreateUserDialog', () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title when open', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByTestId('dialog')).toBeDefined();
    expect(screen.getByTestId('dialog-title')).toBeDefined();
    expect(screen.getByTestId('dialog-desc')).toBeDefined();
  });

  it('should not render dialog when closed', () => {
    render(<CreateUserDialog open={false} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('should render form with submit button', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByTestId('form')).toBeDefined();
    expect(screen.getByTestId('submit-btn')).toBeDefined();
  });

  it('should render three form fields for name, email, and role', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    const fields = screen.getAllByTestId('form-field');
    expect(fields).toHaveLength(3);
  });

  it('should render role select dropdown with options', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByTestId('role-select')).toBeDefined();

    // All role options should be rendered
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3); // admin, instructor, student
    expect(options[0].getAttribute('value')).toBe('admin');
    expect(options[1].getAttribute('value')).toBe('instructor');
    expect(options[2].getAttribute('value')).toBe('student');
  });

  it('should render submit button with Create label', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByText('Create')).toBeDefined();
  });

  it('should render submit button and form', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByTestId('form')).toBeDefined();
    expect(screen.getByTestId('submit-btn')).toBeDefined();
  });

  it('should call onSubmit when form is submitted', async () => {
    const submitFn = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { container } = render(
      <CreateUserDialog open={true} onOpenChange={onClose} onSubmit={submitFn} />,
    );

    // Find the actual form element and submit it
    const formEl = container.querySelector('form');
    if (formEl) {
      fireEvent.submit(formEl);
    }

    await vi.waitFor(() => {
      expect(submitFn).toHaveBeenCalledOnce();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should validate the Zod schema correctly', () => {
    // Valid input
    const valid = CreateUserSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      role: 'student',
    });
    expect(valid.success).toBe(true);

    // Invalid email
    const invalidEmail = CreateUserSchema.safeParse({
      name: 'Test',
      email: 'not-an-email',
      role: 'student',
    });
    expect(invalidEmail.success).toBe(false);

    // Empty name
    const emptyName = CreateUserSchema.safeParse({
      name: '',
      email: 'test@example.com',
      role: 'student',
    });
    expect(emptyName.success).toBe(false);

    // Invalid role (superadmin not allowed via create)
    const invalidRole = CreateUserSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      role: 'superadmin',
    });
    expect(invalidRole.success).toBe(false);
  });

  it('should use SelectValue component for display (data-testid="select-value-component")', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByTestId('select-value-component')).toBeDefined();
  });

  it('should use ROLES config for role select options', () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    // If ROLES config is used, options should have custom labels
    // If inline SelectItem values are used, options should have original labels
    expect(screen.getByText('adminUsers.role_admin_custom')).toBeDefined();
    expect(screen.queryByText('adminUsers.role_admin')).toBeNull();
  });

  it('should show success toast on successful user creation', async () => {
    const submitFn = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { container } = render(
      <CreateUserDialog open={true} onOpenChange={onClose} onSubmit={submitFn} />,
    );

    const formEl = container.querySelector('form');
    if (formEl) fireEvent.submit(formEl);

    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('User created successfully');
    });
  });

  it('should not show success toast when onSubmit rejects', async () => {
    const submitFn = vi.fn().mockRejectedValue(new Error('Server error'));
    const onClose = vi.fn();
    const { container } = render(
      <CreateUserDialog open={true} onOpenChange={onClose} onSubmit={submitFn} />,
    );

    const formEl = container.querySelector('form');
    if (formEl) fireEvent.submit(formEl);

    await vi.waitFor(() => {
      expect(submitFn).toHaveBeenCalledOnce();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });
});
