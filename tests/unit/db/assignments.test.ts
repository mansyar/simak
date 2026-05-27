import { describe, it, expect } from 'vitest';

describe('Assignments schema', () => {
  it('should export all tables', async () => {
    const mod = await import('@/db/schema/assignments');
    expect(mod).toHaveProperty('assignments');
    expect(mod).toHaveProperty('assignmentStudents');
    expect(mod).toHaveProperty('checkpoints');
  });

  it('should have correct columns on assignments', async () => {
    const { assignments } = await import('@/db/schema/assignments');
    expect(assignments).toHaveProperty('id');
    expect(assignments).toHaveProperty('templateId');
    expect(assignments).toHaveProperty('title');
    expect(assignments).toHaveProperty('description');
    expect(assignments).toHaveProperty('finalDeadline');
    expect(assignments).toHaveProperty('instructorId');
    expect(assignments).toHaveProperty('createdAt');
    expect(assignments).toHaveProperty('updatedAt');
    expect(assignments).toHaveProperty('deletedAt');
  });

  it('should have correct columns on assignmentStudents', async () => {
    const { assignmentStudents } = await import('@/db/schema/assignments');
    expect(assignmentStudents).toHaveProperty('id');
    expect(assignmentStudents).toHaveProperty('assignmentId');
    expect(assignmentStudents).toHaveProperty('studentId');
    expect(assignmentStudents).toHaveProperty('createdAt');
  });

  it('should have correct columns on checkpoints', async () => {
    const { checkpoints } = await import('@/db/schema/assignments');
    expect(checkpoints).toHaveProperty('id');
    expect(checkpoints).toHaveProperty('assignmentId');
    expect(checkpoints).toHaveProperty('name');
    expect(checkpoints).toHaveProperty('order');
    expect(checkpoints).toHaveProperty('dueDate');
    expect(checkpoints).toHaveProperty('minConsultations');
    expect(checkpoints).toHaveProperty('state');
    expect(checkpoints).toHaveProperty('createdAt');
    expect(checkpoints).toHaveProperty('updatedAt');
  });

  it('should export checkpointState enum', async () => {
    const { checkpointState } = await import('@/db/schema/assignments');
    expect(checkpointState).toBeDefined();
  });
});
