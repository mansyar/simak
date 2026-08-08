/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';
import { persistAcademicRecordsForRelease } from '@/server/academic-records.server';

const assignmentContext = {
  id: 42,
  sectionId: 7,
  courseId: 9,
  termId: 3,
  termStartDate: '2026-01-01',
  credits: '3.00',
};

const publishedConfig = {
  releaseStatus: 'published',
  activeReleaseVersion: 1,
};

const policy = {
  id: 5,
  version: 2,
  gradePoints: { A: 4, B: 3, C: 2, D: 1, F: 0 },
  roundingScale: 2,
};

const completeSnapshot = {
  id: 100,
  studentId: 'student-1',
  releaseVersion: 1,
  numericScore: '91.25',
  letterGrade: 'A',
  status: 'complete',
  publishedAt: new Date('2026-02-01T10:00:00Z'),
};

function createMockDb(selectResults: unknown[]) {
  const insertedValues: unknown[] = [];
  let selectIndex = 0;

  const db: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(() => {
      const result = selectResults[selectIndex++];
      const query = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve(result).then(onFulfilled),
      };
      return query;
    }),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertedValues.push(values);
        return {
          returning: vi.fn(() =>
            Promise.resolve(
              (Array.isArray(values) ? values : [values]).map((value, index) => ({
                ...(value as object),
                id: 900 + index,
              })),
            ),
          ),
        };
      }),
    })),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
  };

  return { db, insertedValues };
}

function validSelectResults(
  overrides: {
    sources?: unknown[];
    config?: unknown[];
    snapshots?: unknown[];
    existing?: unknown[];
  } = {},
) {
  return [
    [assignmentContext],
    overrides.sources ?? [{ id: assignmentContext.id }],
    overrides.config ?? [publishedConfig],
    [policy],
    overrides.snapshots ?? [completeSnapshot],
    overrides.existing ?? [],
  ];
}

async function runPersistence(
  overrides: Parameters<typeof validSelectResults>[0] = {},
  input: { assignmentId: number; releaseVersion: number } = {
    assignmentId: assignmentContext.id,
    releaseVersion: 1,
  },
) {
  const mock = createMockDb(validSelectResults(overrides));
  const result = await persistAcademicRecordsForRelease(mock.db as never, input);
  return { ...mock, result };
}

describe('persistAcademicRecordsForRelease', () => {
  it('creates an immutable record from an eligible published snapshot', async () => {
    const { db, insertedValues, result } = await runPersistence();

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(insertedValues).toEqual([
      [
        expect.objectContaining({
          studentId: 'student-1',
          courseId: 9,
          courseSectionId: 7,
          termId: 3,
          sourceAssignmentId: 42,
          sourceSnapshotId: 100,
          sourceReleaseVersion: 1,
          policyVersion: 2,
          recordVersion: 1,
          numericScore: '91.25',
          letterGrade: 'A',
          status: 'complete',
          credits: '3.00',
          gradePoints: '4.00',
          publishedAt: completeSnapshot.publishedAt,
        }),
      ],
    ]);
    expect(result).toMatchObject({
      assignmentId: 42,
      releaseVersion: 1,
      policyVersion: 2,
      createdCount: 1,
    });
  });

  it('creates a new immutable version when a later release supersedes a prior one', async () => {
    const laterSnapshot = {
      ...completeSnapshot,
      id: 200,
      releaseVersion: 2,
      numericScore: '94.00',
      letterGrade: 'A',
      publishedAt: new Date('2026-03-01T10:00:00Z'),
    };
    const { insertedValues, result } = await runPersistence(
      {
        config: [{ ...publishedConfig, activeReleaseVersion: 2 }],
        snapshots: [laterSnapshot],
        existing: [
          {
            id: 901,
            studentId: 'student-1',
            sourceSnapshotId: completeSnapshot.id,
            sourceReleaseVersion: 1,
            recordVersion: 1,
          },
        ],
      },
      { assignmentId: assignmentContext.id, releaseVersion: 2 },
    );

    expect(insertedValues[0]).toEqual([
      expect.objectContaining({
        sourceSnapshotId: 200,
        sourceReleaseVersion: 2,
        recordVersion: 2,
        numericScore: '94.00',
      }),
    ]);
    expect(result).toMatchObject({ releaseVersion: 2, createdCount: 1 });
  });

  it.each([
    {
      label: 'missing snapshots',
      overrides: { snapshots: [] },
      message: 'No eligible published grade snapshots',
    },
    {
      label: 'ambiguous transcript sources',
      overrides: { sources: [{ id: 42 }, { id: 43 }] },
      message: 'exactly one transcript-source assignment',
    },
    {
      label: 'draft release',
      overrides: { config: [{ releaseStatus: 'draft', activeReleaseVersion: null }] },
      message: 'published release',
    },
    {
      label: 'unpublished release version',
      overrides: { config: [{ ...publishedConfig, activeReleaseVersion: 2 }] },
      message: 'active release version',
    },
    {
      label: 'ineligible snapshot',
      overrides: {
        snapshots: [
          { ...completeSnapshot, status: 'incomplete', numericScore: null, letterGrade: null },
        ],
      },
      message: 'No eligible published grade snapshots',
    },
  ])('$label is rejected', async ({ overrides, message }) => {
    await expect(runPersistence(overrides)).rejects.toThrow(message);
  });
});
