/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockImplementation((_path: string) => (config: any) => config),
}));

vi.mock('@/server/academic-context', () => ({
  listAcademicTerms: vi.fn(),
  listCourses: vi.fn(),
  listCourseSections: vi.fn(),
  listSectionEnrollments: vi.fn(),
}));

describe('Academic context admin route', () => {
  it('exports a route with a loader and component', async () => {
    const { Route } = await import('@/routes/_authenticated/admin/academic-context');

    expect(Route).toBeDefined();
    expect(typeof Route.loader).toBe('function');
    expect(typeof Route.component).toBe('function');
  });

  it('loads all context collections for the admin surface', async () => {
    const { Route } = await import('@/routes/_authenticated/admin/academic-context');
    const result = await Route.loader?.({} as never);

    expect(result).toHaveProperty('terms');
    expect(result).toHaveProperty('courses');
    expect(result).toHaveProperty('sections');
    expect(result).toHaveProperty('enrollments');
  });
});
