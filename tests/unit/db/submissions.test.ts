import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Submissions schema', () => {
  it('should export submissions and reviews tables', async () => {
    const mod = await import('@/db/schema/submissions');
    expect(mod).toHaveProperty('submissions');
    expect(mod).toHaveProperty('reviews');
  });

  it('should have correct columns on submissions', async () => {
    const { submissions } = await import('@/db/schema/submissions');
    expect(submissions).toHaveProperty('id');
    expect(submissions).toHaveProperty('checkpointId');
    expect(submissions).toHaveProperty('uploadedBy');
    expect(submissions).toHaveProperty('fileKey');
    expect(submissions).toHaveProperty('fileName');
    expect(submissions).toHaveProperty('fileSize');
    expect(submissions).toHaveProperty('version');
    expect(submissions).toHaveProperty('uploadedAt');
  });

  it('should enforce unique constraint on (checkpointId, version)', async () => {
    const { submissions } = await import('@/db/schema/submissions');
    const config = getTableConfig(submissions);
    const constraint = config.uniqueConstraints.find(
      (uc) => uc.name === 'submissions_checkpoint_version_unq',
    );
    expect(constraint).toBeDefined();
    const columnNames = constraint!.columns.map((col) => col.name);
    expect(columnNames).toContain('checkpoint_id');
    expect(columnNames).toContain('version');
  });

  it('should have correct columns on reviews', async () => {
    const { reviews } = await import('@/db/schema/submissions');
    expect(reviews).toHaveProperty('id');
    expect(reviews).toHaveProperty('submissionId');
    expect(reviews).toHaveProperty('instructorId');
    expect(reviews).toHaveProperty('decision');
    expect(reviews).toHaveProperty('comment');
    expect(reviews).toHaveProperty('feedbackFileKey');
    expect(reviews).toHaveProperty('revisionDeadline');
    expect(reviews).toHaveProperty('createdAt');
    expect(reviews).toHaveProperty('reviewedAt');
  });
});
