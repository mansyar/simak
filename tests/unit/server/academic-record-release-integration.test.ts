/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  publishGradeReleaseHandler,
  withdrawGradeReleaseHandler,
} from '@/server/gradebook-extras.server';
import * as academicRecords from '@/server/academic-records.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as audit from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('@/server/academic-records.server', () => ({
  persistAcademicRecordsForReleaseInTransaction: vi.fn(),
  persistWithdrawnAcademicRecordsForReleaseInTransaction: vi.fn(),
}));

const ownerSession = {
  user: { id: 'instructor-1', name: 'Instructor', role: 'instructor' as const },
  session: {} as any,
};

type MockResult = unknown[] | { reject: Error };

function createMockDb() {
  const results: MockResult[] = [];

  const createChain = () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any, onrejected: any) => {
        const result = results.shift() ?? [];
        if ('reject' in result) return Promise.reject(result.reject).then(onfulfilled, onrejected);
        return Promise.resolve(result).then(onfulfilled, onrejected);
      }),
    };
    return chain;
  };

  const db = createChain();
  const tx = createChain();
  db.transaction = vi.fn(async (callback: (transaction: any) => Promise<unknown>) => callback(tx));

  return {
    db,
    tx,
    enqueue: (...items: MockResult[]) => results.push(...items),
  };
}

const assignment = {
  id: 1,
  instructorId: 'instructor-1',
  sectionId: 7,
  isTranscriptSource: true,
};
const draftConfig = {
  releaseStatus: 'draft',
  activeReleaseVersion: null,
  publishedAt: null,
};
const eligibleGrade = {
  studentId: 'student-complete',
  studentName: 'Complete Student',
  numericScore: '92.50',
  letterGrade: 'A',
  status: 'complete',
  contributingCheckpoints: [{ checkpointId: 10, score: 92.5 }],
};
const incompleteGrade = {
  studentId: 'student-incomplete',
  studentName: 'Incomplete Student',
  numericScore: null,
  letterGrade: null,
  status: 'in_progress',
  contributingCheckpoints: [],
};
const missingGrade = {
  studentId: 'student-missing',
  studentName: 'Missing Student',
  numericScore: null,
  letterGrade: null,
  status: null,
  contributingCheckpoints: null,
};

describe('grade-release and academic-record integration', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mock.db as any);
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(ownerSession as any);
    vi.mocked(audit.logAuditEvent).mockResolvedValue(undefined);
    vi.mocked(academicRecords.persistAcademicRecordsForReleaseInTransaction).mockResolvedValue({
      success: true,
    } as never);
    vi.mocked(
      academicRecords.persistWithdrawnAcademicRecordsForReleaseInTransaction,
    ).mockResolvedValue({ success: true, createdCount: 1 } as never);
  });

  it('publishes records only from eligible enrolled snapshots', async () => {
    mock.enqueue(
      [assignment],
      [draftConfig],
      [eligibleGrade, incompleteGrade, missingGrade],
      [],
      [],
    );

    const result = await publishGradeReleaseHandler({
      data: { assignmentId: 1, confirmed: true },
    });

    expect(result).toEqual(expect.objectContaining({ success: true, releaseVersion: 1 }));
    expect(mock.tx.values).toHaveBeenCalledWith([
      expect.objectContaining({
        studentId: 'student-complete',
        releaseVersion: 1,
        status: 'complete',
      }),
    ]);
    expect(academicRecords.persistAcademicRecordsForReleaseInTransaction).toHaveBeenCalledWith(
      mock.tx,
      { assignmentId: 1, releaseVersion: 1 },
    );
  });

  it('creates a new academic-record version after a later release', async () => {
    mock.enqueue(
      [assignment],
      [draftConfig],
      [eligibleGrade],
      [],
      [],
      [assignment],
      [{ releaseStatus: 'published', activeReleaseVersion: 1, publishedAt: new Date() }],
      [],
      [assignment],
      [{ ...draftConfig, activeReleaseVersion: 1 }],
      [eligibleGrade],
      [],
      [],
    );

    await publishGradeReleaseHandler({ data: { assignmentId: 1, confirmed: true } });
    await withdrawGradeReleaseHandler({
      data: { assignmentId: 1, reason: 'Corrected final grade calculation' },
    });
    const result = await publishGradeReleaseHandler({
      data: { assignmentId: 1, confirmed: true },
    });

    expect(result).toEqual(expect.objectContaining({ success: true, releaseVersion: 2 }));
    expect(academicRecords.persistAcademicRecordsForReleaseInTransaction).toHaveBeenNthCalledWith(
      1,
      mock.tx,
      { assignmentId: 1, releaseVersion: 1 },
    );
    expect(academicRecords.persistAcademicRecordsForReleaseInTransaction).toHaveBeenNthCalledWith(
      2,
      mock.tx,
      { assignmentId: 1, releaseVersion: 2 },
    );
  });

  it('creates an explicit withdrawn, GPA-excluded record outcome during authorized withdrawal', async () => {
    mock.enqueue(
      [assignment],
      [{ releaseStatus: 'published', activeReleaseVersion: 3, publishedAt: new Date() }],
      [],
    );

    const result = await withdrawGradeReleaseHandler({
      data: { assignmentId: 1, reason: 'Correction required' },
    });

    expect(result).toEqual({ success: true });
    expect(
      academicRecords.persistWithdrawnAcademicRecordsForReleaseInTransaction,
    ).toHaveBeenCalledWith(mock.tx, {
      assignmentId: 1,
      releaseVersion: 3,
      reason: 'Correction required',
      actorId: 'instructor-1',
    });
  });
});
