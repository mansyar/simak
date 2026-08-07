/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockImplementation((_path: string) => (config: any) => config),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
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
    const route = Route as any;

    expect(route).toBeDefined();
    expect(typeof route.loader).toBe('function');
    expect(typeof route.component).toBe('function');
  });

  it('loads all context collections for the admin surface', async () => {
    const { Route } = await import('@/routes/_authenticated/admin/academic-context');
    const result = await (Route as any).loader?.({} as never);

    expect(result).toHaveProperty('terms');
    expect(result).toHaveProperty('courses');
    expect(result).toHaveProperty('sections');
    expect(result).toHaveProperty('enrollments');
  });
});
