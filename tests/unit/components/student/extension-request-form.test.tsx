import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'extensions.requestTitle': 'Request Deadline Extension',
        'extensions.category': 'Category',
        'extensions.categoryPlaceholder': 'Select a category',
        'extensions.reason': 'Reason',
        'extensions.reasonPlaceholder': 'Explain why you need an extension...',
        'extensions.reasonMinChars': 'Minimum {count} characters required',
        'extensions.duration': 'Duration (days)',
        'extensions.durationHint': 'How many extra days do you need?',
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
        'extensions.errors.categoryRequired': 'Please select a category',
        'extensions.errors.reasonMin': 'Reason must be at least 10 characters',
        'extensions.errors.durationMin': 'Duration must be at least 1 day',
        'extensions.errors.durationMax': 'Duration cannot exceed {max} days',
        'extensions.errors.submitFailed': 'Failed to request extension',
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
  Button: ({ children, type, disabled, ...props }: any) => (
    <button type={type || 'button'} disabled={disabled} data-testid="submit-btn" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Loader2: (props: any) => <svg data-testid="loader2-icon" {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, ...props }: any) => (
    <label htmlFor={htmlFor} data-testid="label" {...props}>
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

  it('should show error when reason is less than 10 characters on blur', async () => {
    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    const textarea = screen.getByPlaceholderText('Explain why you need an extension...');
    fireEvent.change(textarea, { target: { value: 'short' } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(screen.getByText('Reason must be at least 10 characters')).toBeDefined();
    });
  });

  it('should show error when category is not selected on submit', async () => {
    render(
      <ExtensionRequestForm
        assignmentId={1}
        maxExtensionDays={7}
        maxTotalExtensions={3}
        checkpoints={checkpoints}
        onSuccess={onSuccess}
      />,
    );
    const textarea = screen.getByPlaceholderText('Explain why you need an extension...');
    fireEvent.change(textarea, { target: { value: 'I need more time for research work' } });
    const input = screen.getByTestId('duration-input');
    fireEvent.change(input, { target: { value: '3' } });

    const form = screen.getByText('Submit Request').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Please select a category')).toBeDefined();
    });
  });

  it('should show error when duration exceeds maxExtensionDays on submit', async () => {
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
    fireEvent.change(input, { target: { value: '10' } });

    const form = screen.getByText('Submit Request').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Duration cannot exceed 7 days')).toBeDefined();
    });
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

    const form = screen.getByText('Submit Request').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(requestExtension).toHaveBeenCalledOnce();
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('should show error when requestExtension returns error', async () => {
    const requestExtension = (await import('@/server/extensions')).requestExtension;
    (requestExtension as any).mockResolvedValue({
      error: { code: 'INTERNAL', message: 'Failed to request extension' },
    });

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

    const form = screen.getByText('Submit Request').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
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

    const form = screen.getByText('Submit Request').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Extension request submitted successfully!')).toBeDefined();
    });
  });

  it('should show Loader2 spinner in submit button when submitting', async () => {
    const requestExtension = (await import('@/server/extensions')).requestExtension;
    (requestExtension as any).mockReturnValue(new Promise(() => {}));

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

    const form = screen.getByText('Submit Request').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId('loader2-icon')).toBeDefined();
    });
  });
});
