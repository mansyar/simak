import { describe, it, expect } from 'vitest';

describe('Checkpoint Discussions schema', () => {
  it('should export checkpointDiscussions table', async () => {
    const mod = await import('@/db/schema/discussions');
    expect(mod).toHaveProperty('checkpointDiscussions');
  });

  it('should have correct columns on checkpointDiscussions', async () => {
    const { checkpointDiscussions } = await import('@/db/schema/discussions');
    expect(checkpointDiscussions).toHaveProperty('id');
    expect(checkpointDiscussions).toHaveProperty('checkpointId');
    expect(checkpointDiscussions).toHaveProperty('assignmentId');
    expect(checkpointDiscussions).toHaveProperty('userId');
    expect(checkpointDiscussions).toHaveProperty('message');
    expect(checkpointDiscussions).toHaveProperty('parentMessageId');
    expect(checkpointDiscussions).toHaveProperty('createdAt');
    expect(checkpointDiscussions).toHaveProperty('updatedAt');
    expect(checkpointDiscussions).toHaveProperty('deletedAt');
  });

  it('should be re-exported from schema index', async () => {
    const mod = await import('@/db/schema/index');
    expect(mod).toHaveProperty('checkpointDiscussions');
    expect(mod).toHaveProperty('checkpointDiscussionsRelations');
  });
});
