import { describe, it, expect } from 'vitest';

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
