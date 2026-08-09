/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendAcademicRecordPolicyHandler,
  designateTranscriptSourceHandler,
} from '@/server/academic-records-admin.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as audit from '@/lib/audit';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

const adminSession = {
  user: { id: 'admin-1', name: 'Admin', role: 'admin' as const },
  session: {} as any,
};
const studentSession = {
  user: { id: 'student-1', name: 'Student', role: 'student' as const },
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
      for: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
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

describe('academic-record admin handlers', () => {
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mock.db as any);
    vi.mocked(audit.logAuditEvent).mockResolvedValue(undefined);
  });

  it('rejects non-admin transcript-source mutations', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const result = await designateTranscriptSourceHandler({
      data: { sectionId: 7, assignmentId: 42 },
    });

    expect(result).toEqual({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    expect(mock.db.transaction).not.toHaveBeenCalled();
  });

  it('designates a section source under a transaction and audits the actor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mock.enqueue([{ id: 42, sectionId: 7 }], [], []);

    const result = await designateTranscriptSourceHandler({
      data: { sectionId: 7, assignmentId: 42 },
    });

    expect(result).toEqual({ success: true, sectionId: 7, assignmentId: 42 });
    expect(mock.tx.execute).toHaveBeenCalledTimes(1);
    expect(mock.tx.set).toHaveBeenNthCalledWith(1, { isTranscriptSource: false });
    expect(mock.tx.set).toHaveBeenNthCalledWith(2, { isTranscriptSource: true });
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'academic_record.transcript_source_designated',
        entityId: '42',
      }),
    );
  });

  it('appends a validated policy with the next version and audits the actor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mock.enqueue(
      [{ id: 3 }],
      [{ version: 4 }],
      [{ id: 5, version: 5, effectiveTermId: 3, gradePoints: { A: 4, F: 0 }, roundingScale: 2 }],
    );

    const result = await appendAcademicRecordPolicyHandler({
      data: {
        effectiveTermId: 3,
        gradePoints: { A: 4, F: 0 },
        roundingScale: 2,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({ success: true, policy: expect.objectContaining({ version: 5 }) }),
    );
    expect(mock.tx.execute).toHaveBeenCalledTimes(1);
    expect(mock.tx.values).toHaveBeenCalledWith(
      expect.objectContaining({ version: 5, effectiveTermId: 3, isActive: true }),
    );
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'academic_record.policy_appended',
        entityId: '5',
      }),
    );
  });
});
