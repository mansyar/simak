import { jsx as _jsx, Fragment as _Fragment } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsultationForm } from '@/components/consultations/ConsultationForm';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'consultations.checkpoint': 'Checkpoint',
        'consultations.selectCheckpoint': 'Select a checkpoint',
        'consultations.sessionType': 'Session Type',
        'consultations.internal': 'Internal',
        'consultations.external': 'External',
        'consultations.externalConsultantName': 'External Consultant Name',
        'consultations.consultantNamePlaceholder': 'Enter consultant name',
        'consultations.notes': 'Notes',
        'consultations.notesPlaceholder': 'Enter consultation notes',
        'consultations.logConsultation': 'Log Consultation',
        'common.loading': 'Loading...',
      };
      return translations[key] || key;
    },
  }),
}));
vi.mock('@/server/consultations', () => ({
  logConsultation: vi.fn(),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, onClick, disabled, ...props }) =>
    _jsx('button', {
      type: type || 'button',
      onClick: onClick,
      disabled: disabled,
      'data-testid': 'submit-btn',
      ...props,
      children: children,
    }),
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }) =>
    _jsx('label', { htmlFor: htmlFor, 'data-testid': 'label', children: children }),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props) => _jsx('input', { 'data-testid': 'consultant-input', ...props }),
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }) =>
    _jsx('select', {
      'data-testid': 'select',
      value: value,
      onChange: (e) => onValueChange?.(e.target.value),
      children: children,
    }),
  SelectContent: ({ children }) => _jsx(_Fragment, { children: children }),
  SelectItem: ({ value, children }) => _jsx('option', { value: value, children: children }),
  SelectTrigger: ({ children }) => _jsx(_Fragment, { children: children }),
  SelectValue: ({ placeholder }) => _jsx('span', { children: placeholder }),
}));
describe('ConsultationForm', () => {
  const onSuccess = vi.fn();
  const checkpoints = [
    { id: 1, name: 'Proposal' },
    { id: 2, name: 'Chapter 1' },
  ];
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should render checkpoint selector', () => {
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    expect(screen.getByText('Checkpoint')).toBeDefined();
    expect(screen.getByText('Select a checkpoint')).toBeDefined();
  });
  it('should render all checkpoint options', () => {
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    expect(screen.getByText('Proposal')).toBeDefined();
    expect(screen.getByText('Chapter 1')).toBeDefined();
  });
  it('should render session type selector', () => {
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    expect(screen.getByText('Session Type')).toBeDefined();
  });
  it('should show external consultant name input when external is selected', () => {
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[1], { target: { value: 'external' } });
    expect(screen.getByText('External Consultant Name')).toBeDefined();
    expect(screen.getByTestId('consultant-input')).toBeDefined();
  });
  it('should hide external consultant name input when internal is selected', () => {
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[1], { target: { value: 'internal' } });
    expect(screen.queryByTestId('consultant-input')).toBeNull();
  });
  it('should render notes textarea', () => {
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    expect(screen.getByText('Notes')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter consultation notes')).toBeDefined();
  });
  it('should render submit button', () => {
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    expect(screen.getByText('Log Consultation')).toBeDefined();
  });
  it('should disable submit button when no checkpoint selected', () => {
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    expect(screen.getByTestId('submit-btn')).toHaveProperty('disabled', true);
  });
  it('should disable submit button when no notes entered', () => {
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: '1' } });
    expect(screen.getByTestId('submit-btn')).toHaveProperty('disabled', true);
  });
  it('should enable submit button when checkpoint and notes are provided', () => {
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: '1' } });
    const textarea = screen.getByPlaceholderText('Enter consultation notes');
    fireEvent.change(textarea, { target: { value: 'Met with student' } });
    expect(screen.getByTestId('submit-btn')).toHaveProperty('disabled', false);
  });
  it('should call logConsultation and onSuccess on valid submit', async () => {
    const logConsultation = (await import('@/server/consultations')).logConsultation;
    logConsultation.mockResolvedValue({});
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: '1' } });
    const textarea = screen.getByPlaceholderText('Enter consultation notes');
    fireEvent.change(textarea, { target: { value: 'Met with student' } });
    const form = screen.getByRole('button', { name: 'Log Consultation' }).closest('form');
    fireEvent.submit(form);
    await vi.waitFor(() => {
      expect(logConsultation).toHaveBeenCalledOnce();
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });
  it('should show error when logConsultation returns error', async () => {
    const logConsultation = (await import('@/server/consultations')).logConsultation;
    logConsultation.mockResolvedValue({ error: 'Failed to log consultation' });
    render(
      _jsx(ConsultationForm, { assignmentId: 1, checkpoints: checkpoints, onSuccess: onSuccess }),
    );
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: '1' } });
    const textarea = screen.getByPlaceholderText('Enter consultation notes');
    fireEvent.change(textarea, { target: { value: 'Met with student' } });
    const form = screen.getByRole('button', { name: 'Log Consultation' }).closest('form');
    fireEvent.submit(form);
    await vi.waitFor(() => {
      expect(screen.getByText('Failed to log consultation')).toBeDefined();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
