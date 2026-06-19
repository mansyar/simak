import { jsx as _jsx } from 'react/jsx-runtime';
/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    Link: vi
      .fn()
      .mockImplementation(({ children, ...props }) =>
        _jsx('a', { 'data-mock-link': '', href: props.to || '#', ...props, children: children }),
      ),
  };
});
vi.mock('../../../src/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));
describe('StudentDashboard component', () => {
  it('should render active assignments section', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(
      _jsx(StudentDashboard, {
        data: {
          activeAssignments: [],
          upcomingDeadlines: [],
          pendingReviews: [],
          consultationReminders: [],
        },
      }),
    );
    expect(screen.getByText('studentDashboard.activeAssignments')).toBeDefined();
  });
  it('should render upcoming deadlines section', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(
      _jsx(StudentDashboard, {
        data: {
          activeAssignments: [],
          upcomingDeadlines: [],
          pendingReviews: [],
          consultationReminders: [],
        },
      }),
    );
    expect(screen.getByText('studentDashboard.upcomingDeadlines')).toBeDefined();
  });
  it('should render pending reviews section', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(
      _jsx(StudentDashboard, {
        data: {
          activeAssignments: [],
          upcomingDeadlines: [],
          pendingReviews: [],
          consultationReminders: [],
        },
      }),
    );
    expect(screen.getByText('studentDashboard.pendingReviews')).toBeDefined();
  });
  it('should render consultation reminders section', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(
      _jsx(StudentDashboard, {
        data: {
          activeAssignments: [],
          upcomingDeadlines: [],
          pendingReviews: [],
          consultationReminders: [],
        },
      }),
    );
    expect(screen.getByText('studentDashboard.consultationReminders')).toBeDefined();
  });
  it('should show error state when data has error', async () => {
    const { StudentDashboard } = await import('@/components/dashboard/StudentDashboard');
    render(_jsx(StudentDashboard, { data: { error: 'Unauthorized' } }));
    expect(screen.getByText('common.error')).toBeDefined();
  });
});
