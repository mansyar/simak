/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveGradeConfigHandler } from '@/server/gradebook.server';
import { SaveGradeConfigSchema } from '@/server/gradebook';
import { isServerError } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as auditMod from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

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

// ---- Session Fixtures ----

const adminSession = {
  user: { id: 'admin-1', name: 'Admin', role: 'admin' as const },
  session: {} as any,
};

const superadminSession = {
  user: { id: 'super-1', name: 'Super', role: 'superadmin' as const },
  session: {} as any,
};

const instructorSession = {
  user: { id: 'instructor-1', name: 'Instructor', role: 'instructor' as const },
  session: {} as any,
};

const studentSession = {
  user: { id: 'student-1', name: 'Student', role: 'student' as const },
  session: {} as any,
};

// ---- Mock DB Factory ----

function createMockDb() {
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    then: vi.fn(function (this: any, onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };
  return mock;
}

// ---- Tests ----

describe('saveGradeConfigHandler', () => {
  let mockDb: any;

  const equalWeightInput = {
    assignmentId: 1,
    gradingScheme: 'equal_weight' as const,
    customWeights: null,
    letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should reject if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await saveGradeConfigHandler({ data: equalWeightInput });
    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject if instructor (not admin)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const result = await saveGradeConfigHandler({ data: equalWeightInput });
    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject if student (not admin)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    const result = await saveGradeConfigHandler({ data: equalWeightInput });
    expect(isServerError(result)).toBe(true);
  });

  it('should upsert config with equal_weight scheme', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
    const result = await saveGradeConfigHandler({ data: equalWeightInput });
    expect(result).toEqual({ success: true });
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should upsert config with custom_weight when weights sum to 100', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        {
          gradingScheme: 'equal_weight',
          customWeights: null,
          letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
        },
      ]).then(onfulfilled),
    );
    const result = await saveGradeConfigHandler({
      data: {
        assignmentId: 1,
        gradingScheme: 'custom_weight',
        customWeights: { '10': 60, '20': 40 },
        letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
      },
    });
    expect(result).toEqual({ success: true });
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should audit log the config change with previous and new values', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        {
          gradingScheme: 'equal_weight',
          customWeights: null,
          letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
        },
      ]).then(onfulfilled),
    );
    await saveGradeConfigHandler({
      data: {
        assignmentId: 1,
        gradingScheme: 'equal_weight',
        customWeights: null,
        letterGradeBounds: { A: 85, B: 75, C: 65, D: 55 },
      },
    });
    expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'gradebook.config_updated',
      entityType: 'assignment_grade_config',
      entityId: '1',
      details: expect.objectContaining({
        previous: expect.any(Object),
        new: expect.any(Object),
      }),
    });
  });

  it('should accept superadmin role', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(superadminSession as any);
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
    const result = await saveGradeConfigHandler({ data: equalWeightInput });
    expect(result).toEqual({ success: true });
  });
});

describe('SaveGradeConfigSchema (superRefine validation)', () => {
  it('should accept equal_weight with null customWeights', () => {
    const result = SaveGradeConfigSchema.safeParse({
      assignmentId: 1,
      gradingScheme: 'equal_weight',
      customWeights: null,
      letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
    });
    expect(result.success).toBe(true);
  });

  it('should accept custom_weight when weights sum to 100', () => {
    const result = SaveGradeConfigSchema.safeParse({
      assignmentId: 1,
      gradingScheme: 'custom_weight',
      customWeights: { '10': 60, '20': 40 },
      letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject custom_weight when weights do not sum to 100', () => {
    const result = SaveGradeConfigSchema.safeParse({
      assignmentId: 1,
      gradingScheme: 'custom_weight',
      customWeights: { '10': 50, '20': 30 },
      letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject custom_weight when customWeights is null', () => {
    const result = SaveGradeConfigSchema.safeParse({
      assignmentId: 1,
      gradingScheme: 'custom_weight',
      customWeights: null,
      letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
    });
    expect(result.success).toBe(false);
  });
});
