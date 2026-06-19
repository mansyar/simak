import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateUserDialog } from '@/components/admin/users/CreateUserDialog';
import { CreateUserSchema } from '@/server/users';
// Mock react-hook-form to bypass validation and submit with mock values
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn(),
    handleSubmit: (fn) => (e) => {
      if (e?.preventDefault) e.preventDefault();
      return Promise.resolve(fn({ name: 'Test User', email: 'test@example.com', role: 'student' }));
    },
    watch: () => ({}),
    getValues: () => ({}),
    setValue: vi.fn(),
    reset: vi.fn(),
    formState: { errors: {}, isSubmitting: false },
  }),
  Controller: ({ render, name }) => render({ field: { value: '', onChange: vi.fn(), name } }),
  FormProvider: ({ children }) => _jsx('div', { children: children }),
  useFormContext: () => ({
    register: vi.fn(),
    handleSubmit: (fn) => (e) => {
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
  Dialog: ({ children, open }) =>
    open ? _jsx('div', { 'data-testid': 'dialog', children: children }) : null,
  DialogContent: ({ children }) =>
    _jsx('div', { 'data-testid': 'dialog-content', children: children }),
  DialogDescription: ({ children }) =>
    _jsx('div', { 'data-testid': 'dialog-desc', children: children }),
  DialogFooter: ({ children }) =>
    _jsx('div', { 'data-testid': 'dialog-footer', children: children }),
  DialogHeader: ({ children }) =>
    _jsx('div', { 'data-testid': 'dialog-header', children: children }),
  DialogTitle: ({ children }) => _jsx('div', { 'data-testid': 'dialog-title', children: children }),
}));
vi.mock('@/components/ui/form', () => ({
  Form: ({ children }) => _jsx('div', { 'data-testid': 'form', children: children }),
  FormControl: ({ children }) => _jsx('div', { 'data-testid': 'form-control', children: children }),
  FormField: ({ render, name }) => {
    const fieldValues = {
      name: 'Test User',
      email: 'test@example.com',
      role: 'student',
      checkpoints: '',
    };
    return _jsx('div', {
      'data-testid': 'form-field',
      'data-field-name': name,
      children: render
        ? render({ field: { value: fieldValues[name] || '', onChange: () => {}, name } })
        : null,
    });
  },
  FormItem: ({ children }) => _jsx('div', { 'data-testid': 'form-item', children: children }),
  FormLabel: ({ children }) => _jsx('div', { 'data-testid': 'form-label', children: children }),
  FormMessage: () => _jsx('div', { 'data-testid': 'form-message' }),
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }) =>
    _jsx('select', {
      'data-testid': 'role-select',
      onChange: (e) => onValueChange?.(e.target.value),
      children: children,
    }),
  SelectContent: ({ children }) => _jsx('div', { children: children }),
  SelectItem: ({ value, children }) => _jsx('option', { value: value, children: children }),
  SelectTrigger: ({ children }) => _jsx('div', { children: children }),
  SelectValue: ({ placeholder }) => _jsx('span', { children: placeholder }),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props) =>
    _jsx('input', { 'data-testid': `input-${props.name || props.placeholder}`, ...props }),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, loading, ...props }) =>
    _jsx('button', {
      type: type,
      'data-testid': 'submit-btn',
      disabled: loading,
      ...props,
      children: loading ? 'Loading...' : children,
    }),
}));
// Mock useI18n
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
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
    render(_jsx(CreateUserDialog, { open: true, onOpenChange: vi.fn(), onSubmit: onSubmit }));
    expect(screen.getByTestId('dialog')).toBeDefined();
    expect(screen.getByTestId('dialog-title')).toBeDefined();
    expect(screen.getByTestId('dialog-desc')).toBeDefined();
  });
  it('should not render dialog when closed', () => {
    render(_jsx(CreateUserDialog, { open: false, onOpenChange: vi.fn(), onSubmit: onSubmit }));
    expect(screen.queryByTestId('dialog')).toBeNull();
  });
  it('should render form with submit button', () => {
    render(_jsx(CreateUserDialog, { open: true, onOpenChange: vi.fn(), onSubmit: onSubmit }));
    expect(screen.getByTestId('form')).toBeDefined();
    expect(screen.getByTestId('submit-btn')).toBeDefined();
  });
  it('should render three form fields for name, email, and role', () => {
    render(_jsx(CreateUserDialog, { open: true, onOpenChange: vi.fn(), onSubmit: onSubmit }));
    const fields = screen.getAllByTestId('form-field');
    expect(fields).toHaveLength(3);
  });
  it('should render role select dropdown with options', () => {
    render(_jsx(CreateUserDialog, { open: true, onOpenChange: vi.fn(), onSubmit: onSubmit }));
    expect(screen.getByTestId('role-select')).toBeDefined();
    // All role options should be rendered
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3); // admin, instructor, student
    expect(options[0].getAttribute('value')).toBe('admin');
    expect(options[1].getAttribute('value')).toBe('instructor');
    expect(options[2].getAttribute('value')).toBe('student');
  });
  it('should render submit button with Create label', () => {
    render(_jsx(CreateUserDialog, { open: true, onOpenChange: vi.fn(), onSubmit: onSubmit }));
    expect(screen.getByText('Create')).toBeDefined();
  });
  it('should render submit button and form', () => {
    render(_jsx(CreateUserDialog, { open: true, onOpenChange: vi.fn(), onSubmit: onSubmit }));
    expect(screen.getByTestId('form')).toBeDefined();
    expect(screen.getByTestId('submit-btn')).toBeDefined();
  });
  it('should call onSubmit when form is submitted', async () => {
    const submitFn = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { container } = render(
      _jsx(CreateUserDialog, { open: true, onOpenChange: onClose, onSubmit: submitFn }),
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
});
