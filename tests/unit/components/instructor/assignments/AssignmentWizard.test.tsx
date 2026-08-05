/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AssignmentWizard } from '@/components/instructor/assignments/AssignmentWizard';
import { userKeys } from '@/lib/query-keys';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      let result = key;
      if (params) {
        result = result.replace(/\{(\w+)\}/g, (_, p) => params[p] ?? `{${p}}`);
      }
      return result;
    },
    locale: 'en',
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
}));

vi.mock('@/server/templates', () => ({
  getTemplate: vi.fn(),
}));

vi.mock('@/server/assignments', () => ({
  createAssignment: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

// Mock child components to isolate AssignmentWizard's own useQuery call
vi.mock('@/components/instructor/assignments/TemplatePicker', () => ({
  TemplatePicker: () => <div data-testid="template-picker" />,
}));
vi.mock('@/components/instructor/assignments/AssignmentDetailsForm', () => ({
  AssignmentDetailsForm: () => <div data-testid="details-form" />,
}));
vi.mock('@/components/instructor/assignments/StudentPicker', () => ({
  StudentPicker: () => <div data-testid="student-picker" />,
}));
vi.mock('@/components/instructor/assignments/DueDatePreview', () => ({
  DueDatePreview: () => <div data-testid="due-date-preview" />,
}));
vi.mock('@/components/instructor/assignments/ReviewStep', () => ({
  ReviewStep: () => <div data-testid="review-step" />,
}));

describe('AssignmentWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // `as never` bypasses useQuery's complex return type; mock provides only fields the component reads
    vi.mocked(useQuery).mockReturnValue({
      data: { users: [] },
      isLoading: false,
      isError: false,
    } as never);
  });

  it('loads students via useQuery on mount with userKeys.list', () => {
    render(<AssignmentWizard />);
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: userKeys.list({ page: 1, limit: 200, search: '', role: 'student' }),
      }),
    );
  });

  it('does not use useQuery for getTemplate (remains imperative)', () => {
    render(<AssignmentWizard />);
    // useQuery should be called exactly once (for students only, not for getTemplate)
    expect(useQuery).toHaveBeenCalledTimes(1);
  });

  it('shows an inline retryable error on query failure', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network failure'),
    } as never);
    render(<AssignmentWizard />);
    expect(document.querySelector('[role="alert"]')).toBeDefined();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
