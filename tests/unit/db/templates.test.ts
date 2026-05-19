import { describe, it, expect } from 'vitest';

describe('Assignment templates schema', () => {
  it('should export tables from schema module', async () => {
    const mod = await import('@/db/schema/templates');
    expect(mod).toHaveProperty('assignmentTemplates');
    expect(mod).toHaveProperty('templateCheckpoints');
  });

  it('should have correct columns on assignmentTemplates', async () => {
    const { assignmentTemplates } = await import('@/db/schema/templates');
    expect(assignmentTemplates).toHaveProperty('id');
    expect(assignmentTemplates).toHaveProperty('type');
    expect(assignmentTemplates).toHaveProperty('name');
    expect(assignmentTemplates).toHaveProperty('createdBy');
    expect(assignmentTemplates).toHaveProperty('createdAt');
    expect(assignmentTemplates).toHaveProperty('updatedAt');
    expect(assignmentTemplates).toHaveProperty('deletedAt');
  });

  it('should have correct columns on templateCheckpoints', async () => {
    const { templateCheckpoints } = await import('@/db/schema/templates');
    expect(templateCheckpoints).toHaveProperty('id');
    expect(templateCheckpoints).toHaveProperty('templateId');
    expect(templateCheckpoints).toHaveProperty('name');
    expect(templateCheckpoints).toHaveProperty('order');
    expect(templateCheckpoints).toHaveProperty('createdAt');
  });
});
