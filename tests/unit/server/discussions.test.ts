/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import {
  ListDiscussionMessagesSchema,
  PostDiscussionMessageSchema,
  DeleteOwnMessageSchema,
  listDiscussionMessages,
  postDiscussionMessage,
  deleteOwnMessage,
} from '@/server/discussions';

describe('Discussions server function stubs', () => {
  it('exports three server functions', () => {
    expect(listDiscussionMessages).toBeDefined();
    expect(typeof listDiscussionMessages).toBe('function');
    expect(postDiscussionMessage).toBeDefined();
    expect(typeof postDiscussionMessage).toBe('function');
    expect(deleteOwnMessage).toBeDefined();
    expect(typeof deleteOwnMessage).toBe('function');
  });
});

describe('ListDiscussionMessagesSchema', () => {
  it('validates with checkpointId and pagination defaults', () => {
    const result = ListDiscussionMessagesSchema.parse({ checkpointId: 1 });
    expect(result.checkpointId).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('accepts page and limit', () => {
    const result = ListDiscussionMessagesSchema.parse({
      checkpointId: 5,
      page: 2,
      limit: 50,
    });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });

  it('rejects missing checkpointId', () => {
    expect(() => ListDiscussionMessagesSchema.parse({})).toThrow();
  });

  it('rejects non-positive checkpointId', () => {
    expect(() => ListDiscussionMessagesSchema.parse({ checkpointId: 0 })).toThrow();
    expect(() => ListDiscussionMessagesSchema.parse({ checkpointId: -1 })).toThrow();
  });

  it('rejects limit over 100', () => {
    expect(() => ListDiscussionMessagesSchema.parse({ checkpointId: 1, limit: 101 })).toThrow();
  });
});

describe('PostDiscussionMessageSchema', () => {
  it('validates a message within length bounds', () => {
    const result = PostDiscussionMessageSchema.parse({ checkpointId: 1, message: 'Hello' });
    expect(result.message).toBe('Hello');
    expect(result.parentMessageId).toBeUndefined();
  });

  it('accepts optional parentMessageId', () => {
    const result = PostDiscussionMessageSchema.parse({
      checkpointId: 1,
      message: 'Reply',
      parentMessageId: 5,
    });
    expect(result.parentMessageId).toBe(5);
  });

  it('rejects empty message', () => {
    expect(() => PostDiscussionMessageSchema.parse({ checkpointId: 1, message: '' })).toThrow();
  });

  it('rejects message over 2000 chars', () => {
    const longMessage = 'a'.repeat(2001);
    expect(() =>
      PostDiscussionMessageSchema.parse({ checkpointId: 1, message: longMessage }),
    ).toThrow();
  });

  it('accepts exactly 2000 chars', () => {
    const maxMessage = 'a'.repeat(2000);
    const result = PostDiscussionMessageSchema.parse({ checkpointId: 1, message: maxMessage });
    expect(result.message).toHaveLength(2000);
  });

  it('rejects missing checkpointId', () => {
    expect(() => PostDiscussionMessageSchema.parse({ message: 'Hello' })).toThrow();
  });
});

describe('DeleteOwnMessageSchema', () => {
  it('validates with messageId', () => {
    const result = DeleteOwnMessageSchema.parse({ messageId: 42 });
    expect(result.messageId).toBe(42);
  });

  it('rejects missing messageId', () => {
    expect(() => DeleteOwnMessageSchema.parse({})).toThrow();
  });

  it('rejects non-positive messageId', () => {
    expect(() => DeleteOwnMessageSchema.parse({ messageId: 0 })).toThrow();
    expect(() => DeleteOwnMessageSchema.parse({ messageId: -1 })).toThrow();
  });
});
