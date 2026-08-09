import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createFileRoute: vi.fn().mockImplementation(() => (config: unknown) => config),
    useRouter: vi.fn(),
  };
});

const { mockReportCatalogControls } = vi.hoisted(() => ({
  mockReportCatalogControls: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/reporting/ReportCatalogControls', () => ({
  ReportCatalogControls: mockReportCatalogControls,
}));

import { Route as AdminReportsRoute } from '@/routes/_authenticated/admin/reports';
import { Route as InstructorReportsRoute } from '@/routes/_authenticated/instructor/reports';
import { Route as StudentReportsRoute } from '@/routes/_authenticated/student/reports';

describe('reporting role routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defines admin, instructor, and student route modules', () => {
    expect(AdminReportsRoute).toBeDefined();
    expect(InstructorReportsRoute).toBeDefined();
    expect(StudentReportsRoute).toBeDefined();
  });

  it('renders the catalog with the admin role', () => {
    const Component = (AdminReportsRoute as any).component;
    render(<Component />);
    expect(mockReportCatalogControls).toHaveBeenCalledTimes(1);
    expect(mockReportCatalogControls.mock.calls[0][0]).toEqual({ role: 'admin' });
  });

  it('renders the catalog with the instructor role', () => {
    const Component = (InstructorReportsRoute as any).component;
    render(<Component />);
    expect(mockReportCatalogControls).toHaveBeenCalledTimes(1);
    expect(mockReportCatalogControls.mock.calls[0][0]).toEqual({ role: 'instructor' });
  });

  it('renders the catalog with the student role', () => {
    const Component = (StudentReportsRoute as any).component;
    render(<Component />);
    expect(mockReportCatalogControls).toHaveBeenCalledTimes(1);
    expect(mockReportCatalogControls.mock.calls[0][0]).toEqual({ role: 'student' });
  });

  it('never renders a foreign role from a role-scoped route', () => {
    const StudentComponent = (StudentReportsRoute as any).component;
    const InstructorComponent = (InstructorReportsRoute as any).component;
    const AdminComponent = (AdminReportsRoute as any).component;
    render(<StudentComponent />);
    render(<InstructorComponent />);
    render(<AdminComponent />);
    const roles = mockReportCatalogControls.mock.calls.map((call) => call[0].role);
    expect(roles).toEqual(['student', 'instructor', 'admin']);
  });
});
