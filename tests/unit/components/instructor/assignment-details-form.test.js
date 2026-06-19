import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignmentDetailsForm } from '@/components/instructor/assignments/AssignmentDetailsForm';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key, params) => {
      const translations = {
        'instructorAssignments.wizard.stepDetails': 'Step 2: Assignment Details',
        'instructorAssignments.wizard.fillDetailsPrompt': 'Fill in the basic information',
        'instructorAssignments.wizard.titleLabel': 'Title',
        'instructorAssignments.wizard.titlePlaceholder': 'Enter title',
        'instructorAssignments.wizard.descriptionLabel': 'Description',
        'instructorAssignments.wizard.descriptionPlaceholder': 'Enter description',
        'instructorAssignments.wizard.deadlineLabel': 'Deadline',
      };
      let text = translations[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, v);
        });
      }
      return text;
    },
  }),
}));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }) => _jsx('div', { className: className, children: children }),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props) => _jsx('input', { ...props }),
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }) => _jsx('label', { htmlFor: htmlFor, children: children }),
}));
describe('AssignmentDetailsForm', () => {
  const defaultProps = {
    title: '',
    onChangeTitle: vi.fn(),
    description: '',
    onChangeDescription: vi.fn(),
    finalDeadline: '',
    onChangeDeadline: vi.fn(),
    errors: {},
  };
  it('should render form with labels and placeholders', () => {
    render(_jsx(AssignmentDetailsForm, { ...defaultProps }));
    expect(screen.getByText('Step 2: Assignment Details')).toBeDefined();
    expect(screen.getByText('Fill in the basic information')).toBeDefined();
    // Title label with required asterisk in a separate <span>
    expect(screen.getByText('Title')).toBeDefined();
    // Deadline label with required asterisk
    expect(screen.getByText('Deadline')).toBeDefined();
    // Both Title and Deadline have required asterisks
    expect(screen.getAllByText('*').length).toBe(2);
    expect(screen.getByPlaceholderText('Enter title')).toBeDefined();
    expect(screen.getByText('Description')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter description')).toBeDefined();
  });
  it('should call onChangeTitle when title input changes', () => {
    render(_jsx(AssignmentDetailsForm, { ...defaultProps }));
    const titleInput = screen.getByPlaceholderText('Enter title');
    fireEvent.change(titleInput, { target: { value: 'New Assignment' } });
    expect(defaultProps.onChangeTitle).toHaveBeenCalledWith('New Assignment');
  });
  it('should call onChangeDescription when description input changes', () => {
    render(_jsx(AssignmentDetailsForm, { ...defaultProps }));
    const descInput = screen.getByPlaceholderText('Enter description');
    fireEvent.change(descInput, { target: { value: 'This is the task description.' } });
    expect(defaultProps.onChangeDescription).toHaveBeenCalledWith('This is the task description.');
  });
  it('should call onChangeDeadline when deadline input changes', () => {
    const { container } = render(_jsx(AssignmentDetailsForm, { ...defaultProps }));
    const deadlineInput = container.querySelector('#assignment-deadline');
    expect(deadlineInput).not.toBeNull();
    fireEvent.change(deadlineInput, { target: { value: '2026-12-31T23:59' } });
    expect(defaultProps.onChangeDeadline).toHaveBeenCalledWith('2026-12-31T23:59');
  });
  it('should display error messages', () => {
    const propsWithErrors = {
      ...defaultProps,
      errors: {
        title: 'Title is required',
        description: 'Description is too long',
        finalDeadline: 'Deadline must be in the future',
      },
    };
    render(_jsx(AssignmentDetailsForm, { ...propsWithErrors }));
    expect(screen.getByText('Title is required')).toBeDefined();
    expect(screen.getByText('Description is too long')).toBeDefined();
    expect(screen.getByText('Deadline must be in the future')).toBeDefined();
  });
});
