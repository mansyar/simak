/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));

import { getDb } from '@/db/index';
import { getSessionFromHeaders } from '@/server/auth';
import { buildReportFilterOptions, getReportCatalogHandler } from '@/server/reporting.server';

const row = {
  termId: 1,
  termCode: '2026-FALL',
  termName: 'Fall 2026',
  courseId: 2,
  courseCode: 'IF101',
  courseName: 'Algorithms',
  sectionId: 3,
  sectionCode: 'A',
  sectionName: 'Morning',
  cohort: '2026',
};

function mockQuery(rows = [row]) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['from', 'innerJoin', 'where']) query[method] = vi.fn(() => query);
  query.orderBy = vi.fn().mockResolvedValue(rows);
  vi.mocked(getDb).mockReturnValue({ select: vi.fn(() => query) } as never);
  return query;
}

describe('reporting catalog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deduplicates normalized authorized filter options', () => {
    expect(buildReportFilterOptions([row, row])).toEqual({
      terms: [{ id: 1, code: '2026-FALL', name: 'Fall 2026' }],
      courses: [{ id: 2, code: 'IF101', name: 'Algorithms' }],
      sections: [{ id: 3, code: 'A', name: 'Morning', cohort: '2026' }],
      cohorts: ['2026'],
    });
  });

  it.each([
    ['admin', ['institutional_academic_summary', 'official_transcript', 'analytics_summary'], 2],
    [
      'superadmin',
      ['institutional_academic_summary', 'official_transcript', 'analytics_summary'],
      2,
    ],
    ['instructor', ['analytics_summary'], 3],
    ['student', ['official_transcript'], 3],
  ] as const)('enforces the %s catalog and filter query scope', async (role, reports, joins) => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({ user: { id: 'user-1', role } } as never);
    const query = mockQuery();

    await expect(getReportCatalogHandler({ data: {} })).resolves.toMatchObject({ reports });
    expect(query.innerJoin).toHaveBeenCalledTimes(joins);
  });

  it('rejects unauthenticated access before querying filters', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(null);
    await expect(getReportCatalogHandler({ data: {} })).resolves.toMatchObject({
      error: { code: 'UNAUTHORIZED' },
    });
    expect(getDb).not.toHaveBeenCalled();
  });
});
