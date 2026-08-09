import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createFileRoute: vi.fn().mockImplementation(() => (config: unknown) => config),
    useRouter: vi.fn(),
  };
});

vi.mock('@/server/academic-records', () => ({
  getStudentAcademicRecords: vi.fn(),
  getInstructorAcademicRecords: vi.fn(),
  getAdminAcademicRecords: vi.fn(),
}));

vi.mock('@/server/instructor-assignment-context', () => ({
  listInstructorAssignmentSections: vi.fn(),
}));

import { Route as AdminAcademicRecordsRoute } from '@/routes/_authenticated/admin/academic-records';
import { Route as InstructorAcademicRecordsRoute } from '@/routes/_authenticated/instructor/academic-records';
import { Route as StudentAcademicRecordsRoute } from '@/routes/_authenticated/student/academic-records';

describe('academic-record routes', () => {
  it('defines student, instructor, and admin route modules', () => {
    expect(StudentAcademicRecordsRoute).toBeDefined();
    expect(InstructorAcademicRecordsRoute).toBeDefined();
    expect(AdminAcademicRecordsRoute).toBeDefined();
  });

  it('defaults instructor records to the first authorized section and preserves filters', async () => {
    const { listInstructorAssignmentSections } =
      await import('@/server/instructor-assignment-context');
    const { getInstructorAcademicRecords } = await import('@/server/academic-records');
    vi.mocked(listInstructorAssignmentSections).mockResolvedValue({
      sections: [
        { id: 7, label: 'CS101 - A' },
        { id: 8, label: 'CS101 - B' },
      ],
    } as never);
    vi.mocked(getInstructorAcademicRecords).mockResolvedValue({
      page: 2,
      limit: 20,
      total: 0,
      terms: [],
      records: [],
      termGpa: null,
      cumulativeGpa: null,
    } as never);

    const result = await (InstructorAcademicRecordsRoute as any).loader({
      deps: { sectionId: undefined, termId: 3, page: 2, limit: 20 },
    });

    expect(getInstructorAcademicRecords).toHaveBeenCalledWith({
      data: { sectionId: 7, termId: 3, page: 2, limit: 20 },
    });
    expect(result.sections).toEqual([
      { id: 7, label: 'CS101 - A' },
      { id: 8, label: 'CS101 - B' },
    ]);
  });
});
