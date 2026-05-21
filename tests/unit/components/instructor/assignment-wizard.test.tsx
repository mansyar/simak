import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssignmentWizard } from '@/components/instructor/assignments/AssignmentWizard';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock i18n
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'instructorAssignments.wizard.stepTemplate': 'Select Template',
        'instructorAssignments.wizard.stepDetails': 'Step 2: Assignment Details',
        'instructorAssignments.wizard.stepStudents': 'Assign Students',
        'instructorAssignments.wizard.stepConfirm': 'Review & Confirm',
        'instructorAssignments.wizard.reviewPrompt': 'Please review before submitting',
        'instructorAssignments.wizard.next': 'Next',
        'instructorAssignments.wizard.prev': 'Back',
        'instructorAssignments.wizard.submit': 'Create Assignment',
        'instructorAssignments.wizard.submitting': 'Creating...',
        'instructorAssignments.details.description': 'Description',
        'instructorAssignments.details.deadline': 'Deadline',
        'common.cancel': 'Cancel',
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

// Mock server functions
vi.mock('@/server/assignments', () => ({
  createAssignment: vi.fn(),
}));

vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
}));

// Helper: navigate through all 3 steps to reach Step 4 or trigger validation on Step 3
function navigateToStep4({ selectStudents = true }: { selectStudents?: boolean } = {}) {
  fireEvent.click(screen.getByTestId('select-thesis-template'));
  fireEvent.click(screen.getByText('Next'));
  fireEvent.change(screen.getByTestId('input-title'), { target: { value: 'Final Thesis' } });
  const fd = new Date();
  fd.setFullYear(fd.getFullYear() + 1);
  fireEvent.change(screen.getByTestId('input-deadline'), {
    target: { value: fd.toISOString().slice(0, 16) },
  });
  fireEvent.click(screen.getByText('Next'));
  if (selectStudents) {
    fireEvent.click(screen.getByTestId('toggle-student-1'));
    fireEvent.click(screen.getByTestId('toggle-student-2'));
  }
  // Always press Next to either advance to Step 4 or trigger validation
  fireEvent.click(screen.getByText('Next'));
}

// Mock child components to simplify tests
const mockTemplate = {
  id: 1,
  name: 'Thesis Template',
  type: 'Thesis',
  checkpoints: ['Proposal', 'Drafting', 'Defense'],
};
vi.mock('@/components/instructor/assignments/TemplatePicker', () => ({
  TemplatePicker: ({ selectedTemplateId, onSelectTemplate }: any) => (
    <div data-testid="template-picker">
      <span data-testid="selected-template-id">
        {selectedTemplateId === null ? 'none' : String(selectedTemplateId)}
      </span>
      <button data-testid="select-thesis-template" onClick={() => onSelectTemplate(mockTemplate)}>
        Select Thesis Template
      </button>
    </div>
  ),
}));

vi.mock('@/components/instructor/assignments/AssignmentDetailsForm', () => ({
  AssignmentDetailsForm: ({
    title,
    onChangeTitle,
    description,
    onChangeDescription,
    finalDeadline,
    onChangeDeadline,
    errors,
  }: any) => (
    <div data-testid="details-form">
      <input
        data-testid="input-title"
        value={title}
        onChange={(e) => onChangeTitle(e.target.value)}
        placeholder="Assignment title"
      />
      <input
        data-testid="input-description"
        value={description}
        onChange={(e) => onChangeDescription(e.target.value)}
        placeholder="Assignment description"
      />
      <input
        data-testid="input-deadline"
        value={finalDeadline}
        onChange={(e) => onChangeDeadline(e.target.value)}
        placeholder="Deadline"
      />
      {errors.title && <span data-testid="error-title">{errors.title}</span>}
      {errors.finalDeadline && <span data-testid="error-deadline">{errors.finalDeadline}</span>}
    </div>
  ),
}));

vi.mock('@/components/instructor/assignments/StudentPicker', () => ({
  StudentPicker: ({
    selectedStudentIds,
    onToggleStudent,
    onSelectAll,
    onDeselectAll,
    errors,
  }: any) => (
    <div data-testid="student-picker">
      <span data-testid="selected-count">{selectedStudentIds.length}</span>
      <button data-testid="toggle-student-1" onClick={() => onToggleStudent('student-1')}>
        Toggle Alice
      </button>
      <button data-testid="toggle-student-2" onClick={() => onToggleStudent('student-2')}>
        Toggle Bob
      </button>
      <button data-testid="select-all" onClick={() => onSelectAll(['student-1', 'student-2'])}>
        Select All
      </button>
      <button data-testid="deselect-all" onClick={() => onDeselectAll()}>
        Deselect All
      </button>
      {errors.studentIds && <span data-testid="error-students">{errors.studentIds}</span>}
    </div>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
}));

import * as assignmentsApi from '@/server/assignments';
import * as usersApi from '@/server/users';

describe('AssignmentWizard', () => {
  const mockStudents = [
    { id: 'student-1', name: 'Alice Cooper', email: 'alice@test.com' },
    { id: 'student-2', name: 'Bob Marley', email: 'bob@test.com' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.listUsers).mockResolvedValue({ users: mockStudents, total: 2 } as any);
  });

  describe('Initial Render and Step Navigation', () => {
    it('should render all 4 wizard steps in the progress bar', () => {
      render(<AssignmentWizard />);
      expect(screen.getByText('Select Template')).toBeDefined();
      expect(screen.getByText('Step 2: Assignment Details')).toBeDefined();
      expect(screen.getByText('Assign Students')).toBeDefined();
      expect(screen.getByText('Review & Confirm')).toBeDefined();
    });

    it('should start on step 1 (TemplatePicker)', () => {
      render(<AssignmentWizard />);
      expect(screen.getByTestId('template-picker')).toBeDefined();
      expect(screen.queryByTestId('details-form')).toBeNull();
      expect(screen.queryByTestId('student-picker')).toBeNull();
    });

    it('should show Cancel button on step 1 and navigate back on click', () => {
      render(<AssignmentWizard />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/instructor/assignments' });
    });

    it('should advance to step 2 when Next is clicked with template selected', () => {
      render(<AssignmentWizard />);
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('details-form')).toBeDefined();
      expect(screen.queryByTestId('template-picker')).toBeNull();
    });

    it('should prevent advancing past step 1 without selecting a template', () => {
      render(<AssignmentWizard />);
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('template-picker')).toBeDefined();
      expect(screen.queryByTestId('details-form')).toBeNull();
    });

    it('should navigate back from step 2 to step 1', () => {
      render(<AssignmentWizard />);
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('details-form')).toBeDefined();
      fireEvent.click(screen.getByText('Back'));
      expect(screen.getByTestId('template-picker')).toBeDefined();
      expect(screen.queryByTestId('details-form')).toBeNull();
    });

    it('should auto-fill title with template name when selecting a template', () => {
      render(<AssignmentWizard />);
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      const titleInput = screen.getByTestId('input-title') as HTMLInputElement;
      expect(titleInput.value).toContain('Thesis Template');
    });

    it('should load students on mount', async () => {
      render(<AssignmentWizard />);
      await waitFor(() => {
        expect(usersApi.listUsers).toHaveBeenCalledWith({
          data: { page: 1, limit: 200, search: '', role: 'student' },
        });
      });
    });
  });

  describe('Step 2 - Assignment Details Validation', () => {
    it('should show title error when Next is clicked without entering a title', () => {
      render(<AssignmentWizard />);
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      fireEvent.change(screen.getByTestId('input-title'), { target: { value: '' } });
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('details-form')).toBeDefined();
      expect(screen.getByTestId('error-title').textContent).toBe('Title is required');
    });

    it('should show deadline error when Next is clicked without a deadline', () => {
      render(<AssignmentWizard />);
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      fireEvent.change(screen.getByTestId('input-title'), { target: { value: 'My Assignment' } });
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('error-deadline').textContent).toBe('Deadline is required');
    });

    it('should fill details and advance to step 3', () => {
      render(<AssignmentWizard />);
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      fireEvent.change(screen.getByTestId('input-title'), { target: { value: 'Final Thesis' } });
      fireEvent.change(screen.getByTestId('input-description'), {
        target: { value: 'Complete your final thesis' },
      });
      const fd = new Date();
      fd.setFullYear(fd.getFullYear() + 1);
      fireEvent.change(screen.getByTestId('input-deadline'), {
        target: { value: fd.toISOString().slice(0, 16) },
      });
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('student-picker')).toBeDefined();
    });
  });

  describe('Step 3 - Student Selection Validation', () => {
    it('should show error when Next is clicked without selecting students', () => {
      render(<AssignmentWizard />);
      navigateToStep4({ selectStudents: false });
      expect(screen.getByTestId('error-students').textContent).toBe(
        'Please select at least one student',
      );
    });
  });

  describe('Step 4 - Review and Submit', () => {
    beforeEach(() => {
      vi.mocked(assignmentsApi.createAssignment).mockResolvedValue({
        success: true,
        assignmentId: 42,
      } as any);
    });

    it('should show review screen with all details after completing steps', async () => {
      render(<AssignmentWizard />);
      navigateToStep4();
      await waitFor(() => {
        expect(screen.getAllByText('Review & Confirm').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('Please review before submitting')).toBeDefined();
        expect(screen.getByText('Final Thesis')).toBeDefined();
        expect(screen.getByText('Thesis Template')).toBeDefined();
        expect(screen.getByText('Create Assignment')).toBeDefined();
      });
    });

    it('should call createAssignment and navigate on successful submit', async () => {
      render(<AssignmentWizard />);
      navigateToStep4();
      await waitFor(() => expect(screen.getByText('Create Assignment')).toBeDefined());
      fireEvent.click(screen.getByText('Create Assignment'));
      await waitFor(() => expect(assignmentsApi.createAssignment).toHaveBeenCalledOnce());
      const callArg = vi.mocked(assignmentsApi.createAssignment).mock.calls[0][0] as any;
      expect(callArg.data.title).toBe('Final Thesis');
      expect(callArg.data.templateId).toBe(1);
      expect(callArg.data.studentIds).toEqual(['student-1', 'student-2']);
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/instructor/assignments/42' });
    });

    it('should show submit error when creation fails', async () => {
      vi.mocked(assignmentsApi.createAssignment).mockResolvedValue({
        success: false,
        error: 'Template is no longer available',
      } as any);
      render(<AssignmentWizard />);
      navigateToStep4();
      await waitFor(() => expect(screen.getByText('Create Assignment')).toBeDefined());
      fireEvent.click(screen.getByText('Create Assignment'));
      await waitFor(() =>
        expect(screen.getByText('Template is no longer available')).toBeDefined(),
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should show network error message on exception', async () => {
      vi.mocked(assignmentsApi.createAssignment).mockRejectedValue(new Error('Network failure'));
      render(<AssignmentWizard />);
      navigateToStep4();
      await waitFor(() => expect(screen.getByText('Create Assignment')).toBeDefined());
      fireEvent.click(screen.getByText('Create Assignment'));
      await waitFor(() =>
        expect(screen.getByText('A network error occurred. Please try again.')).toBeDefined(),
      );
    });
  });
});
