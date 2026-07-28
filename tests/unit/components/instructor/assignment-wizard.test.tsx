import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
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
        'instructorAssignments.wizard.stepDueDates': 'Due Dates',
        'instructorAssignments.wizard.stepConfirm': 'Review & Confirm',
        'instructorAssignments.wizard.reviewPrompt': 'Please review before submitting',
        'instructorAssignments.wizard.dueDatesPrompt': 'Review and adjust due dates',
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

vi.mock('@/server/templates', () => ({
  getTemplate: vi.fn(),
}));

vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
}));

vi.mock('@/components/instructor/assignments/DueDatePreview', () => ({
  DueDatePreview: ({ checkpoints, onOverride }: any) => (
    <div data-testid="due-date-preview">
      {checkpoints.map((cp: any) => (
        <span key={cp.order} data-testid={`checkpoint-${cp.order}`}>
          {cp.name}
        </span>
      ))}
      <button
        data-testid="set-override"
        onClick={() => onOverride([{ checkpointOrder: 1, dueDate: '2027-06-15T12:00:00.000Z' }])}
      >
        Set Override
      </button>
    </div>
  ),
}));

// Helper: navigate through all 4 steps to reach Step 5 (Review) or trigger validation on Step 3
function navigateToStep5({ selectStudents = true }: { selectStudents?: boolean } = {}) {
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
  fireEvent.click(screen.getByText('Next'));
  // Step 4 (DueDatePreview) - no validation needed, advance to Step 5
  if (selectStudents) {
    fireEvent.click(screen.getByText('Next'));
  }
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
import * as templatesApi from '@/server/templates';
import * as usersApi from '@/server/users';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('AssignmentWizard', () => {
  const mockStudents = [
    { id: 'student-1', name: 'Alice Cooper', email: 'alice@test.com' },
    { id: 'student-2', name: 'Bob Marley', email: 'bob@test.com' },
  ];

  const mockTemplateDetails = {
    id: 1,
    checkpoints: [
      { name: 'Proposal', order: 1, estimatedDuration: 14 },
      { name: 'Drafting', order: 2, estimatedDuration: 30 },
      { name: 'Defense', order: 3, estimatedDuration: 7 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.listUsers).mockResolvedValue({ users: mockStudents, total: 2 } as any);
    vi.mocked(templatesApi.getTemplate).mockResolvedValue(mockTemplateDetails as any);
  });

  describe('Initial Render and Step Navigation', () => {
    it('should render all 5 wizard steps in the progress bar', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      expect(screen.getAllByText('Select Template').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Step 2: Assignment Details').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Assign Students').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Due Dates').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Review & Confirm').length).toBeGreaterThanOrEqual(1);
    });

    it('should start on step 1 (TemplatePicker)', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      expect(screen.getByTestId('template-picker')).toBeDefined();
      expect(screen.queryByTestId('details-form')).toBeNull();
      expect(screen.queryByTestId('student-picker')).toBeNull();
    });

    it('should show Cancel button on step 1 and navigate back on click', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/instructor/assignments' });
    });

    it('should advance to step 2 when Next is clicked with template selected', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('details-form')).toBeDefined();
      expect(screen.queryByTestId('template-picker')).toBeNull();
    });

    it('should prevent advancing past step 1 without selecting a template', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('template-picker')).toBeDefined();
      expect(screen.queryByTestId('details-form')).toBeNull();
    });

    it('should navigate back from step 2 to step 1', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('details-form')).toBeDefined();
      fireEvent.click(screen.getByText('Back'));
      expect(screen.getByTestId('template-picker')).toBeDefined();
      expect(screen.queryByTestId('details-form')).toBeNull();
    });

    it('should auto-fill title with template name when selecting a template', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      const titleInput = screen.getByTestId('input-title') as HTMLInputElement;
      expect(titleInput.value).toContain('Thesis Template');
    });

    it('should load students on mount', async () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(usersApi.listUsers).toHaveBeenCalledWith({
          data: { page: 1, limit: 200, search: '', role: 'student' },
        });
      });
    });
  });

  describe('Mobile Step Label (UX-35)', () => {
    it('should render current step label visible only on mobile (sm:hidden)', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      // Step 1 label is 'Select Template'
      const matches = screen.getAllByText('Select Template');
      const mobileLabel = matches.find((el) => /\bsm:hidden\b/.test(el.className));
      expect(mobileLabel).toBeDefined();
      expect(mobileLabel?.tagName).toBe('P');
    });

    it('should update mobile step label when navigating to next step', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      // Step 2 label is 'Step 2: Assignment Details'
      const matches = screen.getAllByText('Step 2: Assignment Details');
      const mobileLabel = matches.find((el) => /\bsm:hidden\b/.test(el.className));
      expect(mobileLabel).toBeDefined();
    });

    it('should not render mobile label for non-current steps', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      // On step 1, step 2 label should NOT have sm:hidden (only progress bar version exists)
      const step2Matches = screen.getAllByText('Step 2: Assignment Details');
      const mobileLabel = step2Matches.find((el) => /\bsm:hidden\b/.test(el.className));
      expect(mobileLabel).toBeUndefined();
    });
  });

  describe('Step 2 - Assignment Details Validation', () => {
    it('should show title error when Next is clicked without entering a title', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      fireEvent.change(screen.getByTestId('input-title'), { target: { value: '' } });
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('details-form')).toBeDefined();
      expect(screen.getByTestId('error-title').textContent).toBe(
        'instructorAssignments.wizard.errors.titleRequired',
      );
    });

    it('should show deadline error when Next is clicked without a deadline', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      fireEvent.change(screen.getByTestId('input-title'), { target: { value: 'My Assignment' } });
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('error-deadline').textContent).toBe(
        'instructorAssignments.wizard.errors.deadlineRequired',
      );
    });

    it('should fill details and advance to step 3', () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
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
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      navigateToStep5({ selectStudents: false });
      expect(screen.getByTestId('error-students').textContent).toBe(
        'instructorAssignments.wizard.errors.studentsRequired',
      );
    });
  });

  describe('Step 4 - Due Date Preview', () => {
    it('should render DueDatePreview on step 4 with checkpoint names', async () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      // Wait for async getTemplate to resolve and set checkpointDetails
      await waitFor(() => {
        expect(screen.getByTestId('selected-template-id').textContent).toBe('1');
      });
      fireEvent.click(screen.getByText('Next'));
      fireEvent.change(screen.getByTestId('input-title'), { target: { value: 'Final Thesis' } });
      const fd = new Date();
      fd.setFullYear(fd.getFullYear() + 1);
      fireEvent.change(screen.getByTestId('input-deadline'), {
        target: { value: fd.toISOString().slice(0, 16) },
      });
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByTestId('toggle-student-1'));
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => {
        expect(screen.getByTestId('due-date-preview')).toBeDefined();
        expect(screen.getByTestId('checkpoint-1')).toBeDefined();
      });
      expect(screen.getByTestId('checkpoint-1').textContent).toBe('Proposal');
      expect(screen.getByTestId('checkpoint-2').textContent).toBe('Drafting');
      expect(screen.getByTestId('checkpoint-3').textContent).toBe('Defense');
    });
  });

  describe('Step 5 - Review and Submit', () => {
    beforeEach(() => {
      vi.mocked(assignmentsApi.createAssignment).mockResolvedValue({
        success: true,
        assignmentId: 42,
      } as any);
    });

    it('should show review screen with all details after completing steps', async () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      navigateToStep5();
      await waitFor(() => {
        expect(screen.getAllByText('Review & Confirm').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('Please review before submitting')).toBeDefined();
        expect(screen.getByText('Final Thesis')).toBeDefined();
        expect(screen.getByText('Thesis Template')).toBeDefined();
        expect(screen.getByText('Create Assignment')).toBeDefined();
      });
    });

    it('should call createAssignment and navigate on successful submit', async () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      navigateToStep5();
      await waitFor(() => expect(screen.getByText('Create Assignment')).toBeDefined());
      fireEvent.click(screen.getByText('Create Assignment'));
      await waitFor(() => expect(assignmentsApi.createAssignment).toHaveBeenCalledOnce());
      const callArg = vi.mocked(assignmentsApi.createAssignment).mock.calls[0][0] as any;
      expect(callArg.data.title).toBe('Final Thesis');
      expect(callArg.data.templateId).toBe(1);
      expect(callArg.data.studentIds).toEqual(['student-1', 'student-2']);
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/instructor/assignments/42' });
    });

    it('should show override button on due date step and submit without overrideDueDates when none set', async () => {
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      // Navigate to step 4
      fireEvent.click(screen.getByTestId('select-thesis-template'));
      fireEvent.click(screen.getByText('Next'));
      fireEvent.change(screen.getByTestId('input-title'), { target: { value: 'Final Thesis' } });
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      fireEvent.change(screen.getByTestId('input-deadline'), {
        target: { value: future.toISOString().slice(0, 16) },
      });
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByTestId('toggle-student-1'));
      fireEvent.click(screen.getByText('Next'));
      // Verify override button exists on Step 4
      expect(screen.getByTestId('set-override')).toBeDefined();
      // Advance to Step 5 and submit without setting any override
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => expect(screen.getByText('Create Assignment')).toBeDefined());
      fireEvent.click(screen.getByText('Create Assignment'));
      await waitFor(() => expect(assignmentsApi.createAssignment).toHaveBeenCalledOnce());
      const callArg = vi.mocked(assignmentsApi.createAssignment).mock.calls[0][0] as any;
      expect(callArg.data.title).toBe('Final Thesis');
      // When no override is set, overrideDueDates should not be sent
      expect(callArg.data.overrideDueDates).toBeUndefined();
    });

    it('should show submit error when creation fails', async () => {
      vi.mocked(assignmentsApi.createAssignment).mockResolvedValue({
        error: { code: 'INTERNAL', message: 'Template is no longer available' },
      } as any);
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      navigateToStep5();
      await waitFor(() => expect(screen.getByText('Create Assignment')).toBeDefined());
      fireEvent.click(screen.getByText('Create Assignment'));
      await waitFor(() =>
        expect(screen.getByText('Template is no longer available')).toBeDefined(),
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should show network error message on exception', async () => {
      vi.mocked(assignmentsApi.createAssignment).mockRejectedValue(new Error('Network failure'));
      render(<AssignmentWizard />, { wrapper: createWrapper() });
      navigateToStep5();
      await waitFor(() => expect(screen.getByText('Create Assignment')).toBeDefined());
      fireEvent.click(screen.getByText('Create Assignment'));
      await waitFor(() =>
        expect(screen.getByText('instructorAssignments.wizard.errors.networkError')).toBeDefined(),
      );
    });
  });
});
