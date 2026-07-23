/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncTemplateCheckpoints } from '@/server/template-checkpoint-sync.server';
import { templateCheckpoints } from '@/db/schema/templates';

describe('syncTemplateCheckpoints', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.then.mockImplementation(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    });
  });

  it('should update existing checkpoints matched by ID (preserve IDs)', async () => {
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 10 }, { id: 20 }]).then(onfulfilled),
    );

    await syncTemplateCheckpoints(mockDb as any, 1, [
      { id: 10, name: 'Updated Ch 1', minConsultations: 2, estimatedDuration: 14 },
      { id: 20, name: 'Updated Ch 2', minConsultations: 1, estimatedDuration: 7 },
    ]);

    expect(mockDb.update).toHaveBeenCalledWith(templateCheckpoints);
    const setCalls = vi.mocked(mockDb.set).mock.calls;
    const updateSets = setCalls.filter(
      (call: any[]) => call[0] && call[0].deletedAt === undefined && call[0].name !== undefined,
    );
    expect(updateSets.length).toBe(2);
    expect(mockDb.insert).not.toHaveBeenCalledWith(templateCheckpoints);
  });

  it('should insert new checkpoints without IDs', async () => {
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 10 }]).then(onfulfilled),
    );

    await syncTemplateCheckpoints(mockDb as any, 1, [
      { id: 10, name: 'Existing Ch', minConsultations: 0, estimatedDuration: 7 },
      { name: 'New Ch', minConsultations: 0, estimatedDuration: 7 },
    ]);

    expect(mockDb.insert).toHaveBeenCalledWith(templateCheckpoints);
    const valuesCall = vi
      .mocked(mockDb.values)
      .mock.calls.find(
        (call: any[]) => Array.isArray(call[0]) && call[0].some((r: any) => r.name === 'New Ch'),
      );
    expect(valuesCall).toBeDefined();
    expect(valuesCall![0][0]).toMatchObject({
      templateId: 1,
      name: 'New Ch',
      order: 2,
      minConsultations: 0,
      estimatedDuration: 7,
    });
  });

  it('should soft-delete removed checkpoints (not hard-delete)', async () => {
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 10 }, { id: 20 }]).then(onfulfilled),
    );

    await syncTemplateCheckpoints(mockDb as any, 1, [
      { id: 10, name: 'Kept Ch', minConsultations: 0, estimatedDuration: 7 },
    ]);

    expect(mockDb.delete).not.toHaveBeenCalled();
    const setCalls = vi.mocked(mockDb.set).mock.calls;
    const hasDeletedAt = setCalls.some((call: any[]) => call[0] && call[0].deletedAt !== undefined);
    expect(hasDeletedAt).toBe(true);
  });

  it('should assign sequential order starting at 1', async () => {
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await syncTemplateCheckpoints(mockDb as any, 1, [
      { name: 'Ch 1', minConsultations: 0, estimatedDuration: 7 },
      { name: 'Ch 2', minConsultations: 0, estimatedDuration: 7 },
      { name: 'Ch 3', minConsultations: 0, estimatedDuration: 7 },
    ]);

    const valuesCall = vi
      .mocked(mockDb.values)
      .mock.calls.find((call: any[]) => Array.isArray(call[0]) && call[0].length === 3);
    expect(valuesCall).toBeDefined();
    expect(valuesCall![0][0].order).toBe(1);
    expect(valuesCall![0][1].order).toBe(2);
    expect(valuesCall![0][2].order).toBe(3);
  });

  it('should apply default values for minConsultations and estimatedDuration', async () => {
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await syncTemplateCheckpoints(mockDb as any, 1, [{ name: 'Ch 1' }]);

    const valuesCall = vi
      .mocked(mockDb.values)
      .mock.calls.find((call: any[]) => Array.isArray(call[0]) && call[0].length === 1);
    expect(valuesCall).toBeDefined();
    expect(valuesCall![0][0].minConsultations).toBe(0);
    expect(valuesCall![0][0].estimatedDuration).toBe(7);
  });

  it('should not insert when all checkpoints are existing', async () => {
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 10 }]).then(onfulfilled),
    );

    await syncTemplateCheckpoints(mockDb as any, 1, [
      { id: 10, name: 'Existing', minConsultations: 0, estimatedDuration: 7 },
    ]);

    expect(mockDb.insert).not.toHaveBeenCalledWith(templateCheckpoints);
  });

  it('should not soft-delete when all existing checkpoints are kept', async () => {
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 10 }]).then(onfulfilled),
    );

    await syncTemplateCheckpoints(mockDb as any, 1, [
      { id: 10, name: 'Existing', minConsultations: 0, estimatedDuration: 7 },
    ]);

    const setCalls = vi.mocked(mockDb.set).mock.calls;
    const hasDeletedAt = setCalls.some((call: any[]) => call[0] && call[0].deletedAt !== undefined);
    expect(hasDeletedAt).toBe(false);
  });
});
