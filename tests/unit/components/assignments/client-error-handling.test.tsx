import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TemplatePicker } from '@/components/instructor/assignments/TemplatePicker';
import { StudentPicker } from '@/components/instructor/assignments/StudentPicker';
import { AssignmentWizard } from '@/components/instructor/assignments/AssignmentWizard';
import { Route as CheckpointRoute } from '@/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId';
import * as templatesApi from '@/server/templates';
import * as usersApi from '@/server/users';
import * as assignmentsApi from '@/server/assignments';

const toastError = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
  toast: { error: toastError },
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'errors.fetchFailed': 'Failed to load data. Please try again.',
        'instructorAssignments.wizard.stepTemplate': 'Select Template',
        'instructorAssignments.wizard.stepDetails': 'Assignment Details',
        'instructorAssignments.wizard.stepStudents': 'Assign Students',
        'instructorAssignments.wizard.stepDueDates': 'Due Dates',
        'instructorAssignments.wizard.stepConfirm': 'Review & Confirm',
        'instructorAssignments.wizard.next': 'Next',
        'instructorAssignments.wizard.prev': 'Back',
        'instructorAssignments.wizard.submit': 'Create Assignment',
        'instructorAssignments.wizard.submitting': 'Creating...',
        'instructorAssignments.wizard.selectTemplatePrompt': 'Choose a template',
        'instructorAssignments.wizard.fillDetailsPrompt': 'Enter assignment details',
        'instructorAssignments.wizard.selectStudentsPrompt': 'Select one or more students',
        'instructorAssignments.wizard.selectedStudents': '{count} selected',
        'instructorAssignments.wizard.noStudentsSelected': 'No students selected',
        'instructorAssignments.wizard.searchStudents': 'Search students...',
        'instructorAssignments.wizard.dueDatesPrompt': 'Adjust due dates',
        'instructorAssignments.wizard.reviewPrompt': 'Review before submitting',
        'instructorAssignments.wizard.titleLabel': 'Assignment Title',
        'instructorAssignments.wizard.titlePlaceholder': 'e.g., Undergraduate Thesis 2026',
        'instructorAssignments.wizard.deadlineLabel': 'Final Submission Deadline',
        'instructorAssignments.wizard.descriptionLabel': 'Description / Guidelines',
        'instructorAssignments.wizard.descriptionPlaceholder': 'Provide instructions...',
        'instructorAssignments.details.description': 'Description',
        'instructorAssignments.details.deadline': 'Deadline',
        'instructorAssignments.assignedCohort': 'Assigned Cohort',
        'instructorAssignments.studentsCount': '{count} Students',
        'instructorAssignments.wizard.errors.titleRequired': 'Title is required',
        'instructorAssignments.wizard.errors.deadlineRequired': 'Deadline is required',
        'instructorAssignments.wizard.errors.deadlineInvalid': 'Invalid deadline',
        'instructorAssignments.wizard.errors.deadlineInPast': 'Deadline must be future',
        'instructorAssignments.wizard.errors.studentsRequired': 'Select students',
        'instructorAssignments.wizard.errors.submitFailed': 'Failed to create assignment',
        'instructorAssignments.wizard.errors.networkError': 'Network error.',
        'instructorAssignments.wizard.errors.dueDatesInPast': 'Due dates must be future',
        'instructorAssignments.selectAll': 'Select All',
        'instructorAssignments.deselectAll': 'Deselect All',
        'instructorAssignments.milestonesCheckpoints': '{count} checkpoints',
        'instructorAssignments.selectTemplateHint': 'Select a template',
        'instructorAssignments.initiallyUnlocked': 'Initially unlocked',
        'instructorAssignments.wizard.checkpointsPreview': 'Checkpoints Preview',
        'instructorAssignments.selectedRoadmap': 'Selected Roadmap',
        'instructorAssignments.milestonesSequence': 'Milestones Sequence',
        'common.searchByName': 'Search...',
        'common.noSearchResults': 'No {items} found.',
        'common.cancel': 'Cancel',
        'common.back': 'Back',
        'common.loading': 'Loading...',
        'common.noResults': 'No results',
        'adminTemplates.title': 'Templates',
        'files.table.version': 'Version',
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

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: any) => options,
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('@/server/templates', () => ({
  listTemplates: vi.fn(),
  getTemplate: vi.fn(),
}));

vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
}));

vi.mock('@/server/assignments', () => ({
  createAssignment: vi.fn(),
  getStudentAssignmentDetail: vi.fn(),
}));

vi.mock('@/server/submissions', () => ({
  listSubmissions: vi.fn(),
  submitCheckpoint: vi.fn(),
}));

vi.mock('@/server/reviews', () => ({
  getLatestReview: vi.fn(),
}));

vi.mock('@/server/files', () => ({
  getPresignedUploadUrl: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
}));

async function advanceWizardToReview() {
  fireEvent.click(screen.getByText('Thesis Template'));
  fireEvent.click(screen.getByText('Next'));
  fireEvent.change(screen.getByPlaceholderText('e.g., Undergraduate Thesis 2026'), {
    target: { value: 'Assignment' },
  });
  const future = new Date();
  future.setFullYear(future.getFullYear() + 1);
  fireEvent.change(screen.getByLabelText(/final submission deadline/i), {
    target: { value: future.toISOString().slice(0, 16) },
  });
  fireEvent.click(screen.getByText('Next'));
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeDefined();
  });
  fireEvent.click(screen.getByText('Alice'));
  fireEvent.click(screen.getByText('Next'));
  fireEvent.click(screen.getByText('Next'));
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Client fetch error handling', () => {
  describe('TemplatePicker', () => {
    it('shows an inline retryable error when templates fail to load', async () => {
      vi.mocked(templatesApi.listTemplates).mockRejectedValue(new Error('Network failure'));

      render(<TemplatePicker selectedTemplateId={null} onSelectTemplate={vi.fn()} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(templatesApi.listTemplates).toHaveBeenCalled();
      });

      await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
      expect(toastError).not.toHaveBeenCalled();
    });
  });

  describe('StudentPicker', () => {
    it('shows an inline retryable error when students fail to load', async () => {
      vi.mocked(usersApi.listUsers).mockRejectedValue(new Error('Network failure'));

      render(
        <StudentPicker
          selectedStudentIds={[]}
          onToggleStudent={vi.fn()}
          onSelectAll={vi.fn()}
          onDeselectAll={vi.fn()}
          errors={{}}
        />,
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(usersApi.listUsers).toHaveBeenCalled();
      });

      await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
      expect(toastError).not.toHaveBeenCalled();
    });
  });

  describe('AssignmentWizard', () => {
    const mockStudents = [
      { id: 'student-1', name: 'Alice', email: 'alice@test.com' },
      { id: 'student-2', name: 'Bob', email: 'bob@test.com' },
    ];

    const mockTemplates = [
      {
        id: 1,
        name: 'Thesis Template',
        type: 'Thesis',
        checkpoints: ['Proposal', 'Drafting', 'Defense'],
      },
    ];

    const mockTemplateDetails = {
      id: 1,
      checkpoints: [{ name: 'Proposal', order: 1, estimatedDuration: 14 }],
    };

    beforeEach(() => {
      vi.mocked(templatesApi.listTemplates).mockResolvedValue({
        templates: mockTemplates,
        total: 1,
      } as any);
    });

    it('shows an inline retryable error when the initial student list fails to load', async () => {
      vi.mocked(usersApi.listUsers).mockRejectedValue(new Error('Network failure'));

      render(<AssignmentWizard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(usersApi.listUsers).toHaveBeenCalled();
      });

      await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
      expect(toastError).not.toHaveBeenCalled();
    });

    it('shows an inline retryable error when template details fail to load on select', async () => {
      vi.mocked(usersApi.listUsers).mockResolvedValue({ users: mockStudents, total: 2 } as any);
      vi.mocked(templatesApi.getTemplate).mockRejectedValue(new Error('Network failure'));

      render(<AssignmentWizard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thesis Template')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Thesis Template'));

      await waitFor(() => {
        expect(templatesApi.getTemplate).toHaveBeenCalled();
      });

      await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
      expect(toastError).toHaveBeenCalledWith('Failed to load data. Please try again.');
    });

    it('shows a toast when assignment creation fails to submit', async () => {
      vi.mocked(usersApi.listUsers).mockResolvedValue({ users: mockStudents, total: 2 } as any);
      vi.mocked(templatesApi.getTemplate).mockResolvedValue(mockTemplateDetails as any);
      vi.mocked(assignmentsApi.createAssignment).mockRejectedValue(new Error('Network failure'));

      render(<AssignmentWizard sectionId={1} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Thesis Template')).toBeDefined();
      });

      await advanceWizardToReview();

      await waitFor(() => {
        expect(screen.getByText('Create Assignment')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Create Assignment'));

      await waitFor(() => {
        expect(assignmentsApi.createAssignment).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith('Failed to load data. Please try again.');
      });
    });
  });

  describe('Student checkpoint route loader', () => {
    it('returns a structured error when assignment data fails to load', async () => {
      vi.mocked(assignmentsApi.getStudentAssignmentDetail).mockRejectedValue(
        new Error('Network failure'),
      );

      const loader = (CheckpointRoute as any).loader;
      expect(loader).toBeDefined();

      const result = await loader({ params: { id: '1', checkpointId: '2' } });

      expect(result).toMatchObject({ error: { code: 'INTERNAL' } });
      expect(toastError).not.toHaveBeenCalled();
    });
  });
});
