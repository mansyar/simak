import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'extensions.requestTitle': 'Request Deadline Extension',
        'extensions.category': 'Category',
        'extensions.categoryPlaceholder': 'Select a category',
        'extensions.reason': 'Reason',
        'extensions.reasonPlaceholder': 'Explain why you need an extension...',
        'extensions.duration': 'Duration (days)',
        'extensions.checkpoint': 'Checkpoint',
        'extensions.checkpointHint': 'Select the checkpoint to extend (defaults to current)',
        'extensions.submit': 'Submit Request',
        'extensions.submitting': 'Submitting...',
        'extensions.successMessage': 'Extension request submitted successfully!',
        'extensions.categoryPersonal': 'Personal',
        'extensions.categoryResearch': 'Research',
        'extensions.categoryHealth': 'Health',
        'extensions.categoryOther': 'Other',
        'extensions.maxExtensionsReached': 'Maximum {count} extension(s) allowed.',
        'extensions.daysExceeded': 'Extension days cannot exceed {max}.',
        'common.loading': 'Loading...',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/server/extensions', () => ({
  requestExtension: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, onClick, disabled, ...props }: any) => (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      data-testid="submit-btn"
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => (
    <label htmlFor={htmlFor} data-testid="label">
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="duration-input" {...props} />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <select data-testid="select" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

import { ExtensionRequestForm } from '@/components/student/extensions/ExtensionRequestForm';

describe('ExtensionRequestForm', () => {
  const onSuccess = vi.fn();
  const checkpoints = [
    { id: 1, name: 'Proposal' },
    { id: 2, name: 'Chapter 1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render category selector with all options', () => {
    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Category')).toBeDefined();
    expect(screen.getByText('Personal')).toBeDefined();
    expect(screen.getByText('Research')).toBeDefined();
    expect(screen.getByText('Health')).toBeDefined();
    expect(screen.getByText('Other')).toBeDefined();
  });

  it('should render reason textarea', () => {
    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Reason')).toBeDefined();
    expect(screen.getByPlaceholderText('Explain why you need an extension...')).toBeDefined();
  });

  it('should render duration input', () => {
    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Duration (days)')).toBeDefined();
    expect(screen.getByTestId('duration-input')).toBeDefined();
  });

  it('should render checkpoint selector with options', () => {
    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText('Proposal')).toBeDefined();
    expect(screen.getByText('Chapter 1')).toBeDefined();
  });

  it('should disable submit when form is empty', () => {
    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByTestId('submit-btn')).toHaveProperty('disabled', true);
  });

  it('should enable submit when all required fields are filled', () => {
    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: 'personal' } });
    const textarea = screen.getByPlaceholderText('Explain why you need an extension...');
    fireEvent.change(textarea, { target: { value: 'I need more time for research' } });
    const input = screen.getByTestId('duration-input');
    fireEvent.change(input, { target: { value: '3' } });

    expect(screen.getByTestId('submit-btn')).toHaveProperty('disabled', false);
  });

  it('should call requestExtension and onSuccess on valid submit', async () => {
    const requestExtension = (await import('@/server/extensions')).requestExtension;
    (requestExtension as any).mockResolvedValue({ extensionRequest: { id: 1 } });

    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: 'personal' } });
    const textarea = screen.getByPlaceholderText('Explain why you need an extension...');
    fireEvent.change(textarea, { target: { value: 'I need more time for research work' } });
    const input = screen.getByTestId('duration-input');
    fireEvent.change(input, { target: { value: '3' } });

    const form = screen.getByRole('button', { name: 'Submit Request' }).closest('form')!;
    fireEvent.submit(form);

    await vi.waitFor(() => {
      expect(requestExtension).toHaveBeenCalledOnce();
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('should show error when requestExtension returns error', async () => {
    const requestExtension = (await import('@/server/extensions')).requestExtension;
    (requestExtension as any).mockResolvedValue({ error: 'Failed to request extension' });

    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: 'personal' } });
    const textarea = screen.getByPlaceholderText('Explain why you need an extension...');
    fireEvent.change(textarea, { target: { value: 'I need more time for research work' } });
    const input = screen.getByTestId('duration-input');
    fireEvent.change(input, { target: { value: '3' } });

    const form = screen.getByRole('button', { name: 'Submit Request' }).closest('form')!;
    fireEvent.submit(form);

    await vi.waitFor(() => {
      expect(screen.getByText('Failed to request extension')).toBeDefined();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('should show success message after submission', async () => {
    const requestExtension = (await import('@/server/extensions')).requestExtension;
    (requestExtension as any).mockResolvedValue({ extensionRequest: { id: 1 } });

    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: 'personal' } });
    const textarea = screen.getByPlaceholderText('Explain why you need an extension...');
    fireEvent.change(textarea, { target: { value: 'I need more time for research work' } });
    const input = screen.getByTestId('duration-input');
    fireEvent.change(input, { target: { value: '3' } });

    const form = screen.getByRole('button', { name: 'Submit Request' }).closest('form')!;
    fireEvent.submit(form);

    await vi.waitFor(() => {
      expect(screen.getByText('Extension request submitted successfully!')).toBeDefined();
    });
  });
});
