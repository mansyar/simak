/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import { RequestReportInputSchema } from '@/server/reporting';

const filters = { termId: undefined, courseId: null, sectionId: undefined, cohort: null };

describe('report request schema', () => {
  it.each(['analytics_summary', 'institutional_academic_summary'] as const)(
    'rejects studentId for %s requests',
    (reportType) => {
      expect(
        RequestReportInputSchema.safeParse({
          reportType,
          locale: 'en',
          filters,
          studentId: 'student-1',
        }).success,
      ).toBe(false);
    },
  );

  it('accepts transcript studentId and normalizes filters', () => {
    expect(
      RequestReportInputSchema.parse({
        reportType: 'official_transcript',
        locale: 'id',
        filters,
        studentId: ' student-1 ',
      }),
    ).toEqual({
      reportType: 'official_transcript',
      locale: 'id',
      filters: { termId: null, courseId: null, sectionId: null, cohort: null },
      studentId: 'student-1',
    });
  });
});
