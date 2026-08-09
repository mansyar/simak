import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/academic-records', () => ({
  getStudentAcademicRecords: vi.fn(),
  getInstructorAcademicRecords: vi.fn(),
  getAdminAcademicRecords: vi.fn(),
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
});
