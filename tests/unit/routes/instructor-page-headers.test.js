import { jsx as _jsx } from 'react/jsx-runtime';
/**
 * Smoke test: every instructor page must render <h1> with the canonical
 * heading class string `font-display text-3xl text-foreground` via PageHeader.
 *
 * Heavy child components are stubbed to return simple divs so we can
 * isolate the heading assertion.
 */
/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */
// TanStack Router / Start
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }) => _jsx('a', { ...props, children: children }),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
  createFileRoute: vi.fn().mockImplementation((_path) => (config) => {
    // Provide default mock data for assignment detail page
    const defaultMockData = {
      '/_authenticated/instructor/assignments/$id': {
        id: 1,
        title: 'Test Assignment',
        description: 'Test description',
        finalDeadline: new Date(),
        createdAt: new Date(),
        templateName: 'Test Template',
        templateType: 'programming',
        instructorId: 1,
        students: [],
      },
      '/_authenticated/instructor/reviews/$submissionId': {
        submission: {
          id: 1,
          studentName: 'Test Student',
          assignmentTitle: 'Test Assignment',
          checkpointName: 'Checkpoint 1',
        },
        reviewHistory: [],
      },
    };
    return {
      ...config,
      useLoaderData: vi.fn().mockReturnValue(config.__mockData ?? defaultMockData[_path] ?? {}),
      useSearch: vi.fn().mockReturnValue({ page: 1, limit: 20, search: '' }),
      useNavigate: vi.fn().mockReturnValue(vi.fn()),
      useParams: vi.fn().mockReturnValue({ id: '1', submissionId: '1' }),
    };
  }),
}));
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  useServerFn: vi.fn().mockReturnValue(vi.fn()),
}));
// i18n
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));
// Server functions
vi.mock('@/server/dashboard', () => ({
  getInstructorDashboardData: vi.fn(),
}));
vi.mock('@/server/assignments', () => ({
  listInstructorAssignments: vi.fn(),
  getAssignmentDetail: vi.fn(),
  createAssignment: vi.fn(),
}));
vi.mock('@/server/instructor-assignments-filter', () => ({
  listInstructorAssignmentsForFilter: vi.fn(),
}));
vi.mock('@/server/reviews', () => ({
  listPendingReviews: vi.fn(),
  getReviewDetail: vi.fn(),
  openForReview: vi.fn(),
}));
vi.mock('@/server/consultations', () => ({
  listPendingConsultations: vi.fn(),
}));
// Heavy child components – stub to simple divs so we can isolate headings
vi.mock('@/components/dashboard/InstructorDashboard', () => ({
  InstructorDashboard: () => _jsx('div', { 'data-testid': 'instructor-dashboard' }),
}));
vi.mock('@/components/instructor/assignments/AssignmentCard', () => ({
  AssignmentCard: () => _jsx('div', { 'data-testid': 'assignment-card' }),
}));
vi.mock('@/components/instructor/assignments/AssignmentFilters', () => ({
  AssignmentFilters: () => _jsx('div', { 'data-testid': 'assignment-filters' }),
}));
vi.mock('@/components/instructor/assignments/AssignmentEmptyState', () => ({
  AssignmentEmptyState: () => _jsx('div', { 'data-testid': 'assignment-empty-state' }),
}));
vi.mock('@/components/instructor/assignments/AssignmentLoadingSkeleton', () => ({
  AssignmentLoadingSkeleton: () => _jsx('div', { 'data-testid': 'assignment-loading-skeleton' }),
}));
vi.mock('@/components/instructor/assignments/AssignmentWizard', () => ({
  AssignmentWizard: () => _jsx('div', { 'data-testid': 'assignment-wizard' }),
}));
vi.mock('@/components/admin/templates/TemplatePagination', () => ({
  TemplatePagination: () => _jsx('div', { 'data-testid': 'template-pagination' }),
}));
vi.mock('@/components/reviews/ReviewQueueTable', () => ({
  ReviewQueueTable: () => _jsx('div', { 'data-testid': 'review-queue-table' }),
}));
vi.mock('@/components/reviews/ReviewQueueFilters', () => ({
  ReviewQueueFilters: () => _jsx('div', { 'data-testid': 'review-queue-filters' }),
}));
vi.mock('@/components/reviews/ReviewQueueEmptyState', () => ({
  ReviewQueueEmptyState: () => _jsx('div', { 'data-testid': 'review-queue-empty-state' }),
}));
vi.mock('@/components/reviews/ReviewQueueSkeleton', () => ({
  ReviewQueueSkeleton: () => _jsx('div', { 'data-testid': 'review-queue-skeleton' }),
}));
vi.mock('@/components/reviews/ReviewQueuePagination', () => ({
  ReviewQueuePagination: () => _jsx('div', { 'data-testid': 'review-queue-pagination' }),
}));
vi.mock('@/components/reviews/ReviewDetailHeader', () => ({
  ReviewDetailHeader: ({ studentName }) =>
    _jsx('div', {
      'data-testid': 'review-detail-header',
      children: _jsx('h1', {
        className: 'font-display text-3xl text-foreground',
        children: studentName,
      }),
    }),
}));
vi.mock('@/components/reviews/ReviewHistory', () => ({
  ReviewHistory: () => _jsx('div', { 'data-testid': 'review-history' }),
}));
vi.mock('@/components/reviews/ReviewForm', () => ({
  ReviewForm: () => _jsx('div', { 'data-testid': 'review-form' }),
}));
vi.mock('@/components/reviews/DeadlineManager', () => ({
  DeadlineManager: () => _jsx('div', { 'data-testid': 'deadline-manager' }),
}));
vi.mock('@/components/reviews/ReviewFilePreview', () => ({
  ReviewFilePreview: () => _jsx('div', { 'data-testid': 'review-file-preview' }),
}));
vi.mock('@/components/settings/SettingsPage', () => ({
  SettingsPage: () => _jsx('div', { 'data-testid': 'settings-page' }),
}));
// UI primitives
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => _jsx('button', { ...props, children: children }),
}));
/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */
const CANONICAL_CLASSES = ['font-display', 'text-3xl', 'text-foreground'];
describe('Instructor pages render canonical h1 via PageHeader', () => {
  it('dashboard.tsx renders h1 with canonical class', async () => {
    const mod = await import('@/routes/_authenticated/instructor/dashboard');
    const Component = mod.Route.component ?? mod.Route.Component;
    render(_jsx(Component, {}));
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass(...CANONICAL_CLASSES);
  });
  it('assignments/index.tsx renders h1 with canonical class', async () => {
    const mod = await import('@/routes/_authenticated/instructor/assignments/index');
    const Component = mod.Route.component ?? mod.Route.Component;
    render(_jsx(Component, {}));
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass(...CANONICAL_CLASSES);
  });
  it('assignments/$id.tsx renders h1 with canonical class', async () => {
    const mod = await import('@/routes/_authenticated/instructor/assignments/$id');
    const Component = mod.Route.component ?? mod.Route.Component;
    render(_jsx(Component, {}));
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass(...CANONICAL_CLASSES);
  });
  it('assignments/new.tsx renders h1 with canonical class', async () => {
    const mod = await import('@/routes/_authenticated/instructor/assignments/new');
    const Component = mod.Route.component ?? mod.Route.Component;
    render(_jsx(Component, {}));
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass(...CANONICAL_CLASSES);
  });
  it('reviews/index.tsx renders h1 with canonical class', async () => {
    const mod = await import('@/routes/_authenticated/instructor/reviews/index');
    const Component = mod.Route.component ?? mod.Route.Component;
    render(_jsx(Component, {}));
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass(...CANONICAL_CLASSES);
  });
  it('reviews/$submissionId.tsx renders h1 with canonical class', async () => {
    const mod = await import('@/routes/_authenticated/instructor/reviews/$submissionId');
    const Component = mod.Route.component ?? mod.Route.Component;
    render(_jsx(Component, {}));
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass(...CANONICAL_CLASSES);
  });
  it('settings.tsx renders h1 with canonical class', async () => {
    const mod = await import('@/routes/_authenticated/instructor/settings');
    const Component = mod.Route.component ?? mod.Route.Component;
    render(_jsx(Component, {}));
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass(...CANONICAL_CLASSES);
  });
});
