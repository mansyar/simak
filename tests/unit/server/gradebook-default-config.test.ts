/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefaultGradeConfig } from '@/server/assignments-extras.server';
import { assignmentGradeConfig } from '@/db/schema/gradebook';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn() }));
vi.mock('@/server/due-dates.server', () => ({ computeEffectiveDeadline: vi.fn() }));

function createMockTx() {
  return {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };
}

describe('createDefaultGradeConfig', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should insert default config with equal_weight scheme and default letter bounds', async () => {
    const mockTx = createMockTx();
    mockTx.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));

    await createDefaultGradeConfig(mockTx as any, 42);

    expect(mockTx.insert).toHaveBeenCalledWith(assignmentGradeConfig);
    expect(mockTx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 42,
        gradingScheme: 'equal_weight',
        customWeights: null,
        letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
      }),
    );
  });

  it('should use the provided transaction (not getDb)', async () => {
    const mockTx = createMockTx();
    mockTx.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));

    await createDefaultGradeConfig(mockTx as any, 7);

    // Verify the insert chain runs on the transaction, not getDb
    expect(mockTx.insert).toHaveBeenCalledTimes(1);
  });
});
