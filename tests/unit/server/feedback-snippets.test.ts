/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CreateFeedbackSnippetSchema,
  FeedbackSnippetIdSchema,
  ListFeedbackSnippetsSchema,
  UpdateFeedbackSnippetSchema,
} from '@/server/feedback-snippets';
import * as serverFunctions from '@/server/feedback-snippets';
import {
  archiveFeedbackSnippetHandler,
  createFeedbackSnippetHandler,
  listFeedbackSnippetsHandler,
  restoreFeedbackSnippetHandler,
  updateFeedbackSnippetHandler,
} from '@/server/feedback-snippets.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { isServerError } from '@/lib/errors';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
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

describe('Feedback snippet server functions', () => {
  let mockDb: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };
  const otherInstructorSession = {
    user: { id: 'instructor-2', role: 'instructor' as const },
    session: {} as any,
  };

  const activeSnippet = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Clear explanation',
    category: 'General',
    body: 'Please explain the reasoning in more detail.',
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  function createMockDb() {
    const query: any = {};
    for (const method of [
      'select',
      'from',
      'where',
      'orderBy',
      'insert',
      'values',
      'returning',
      'update',
      'set',
    ]) {
      query[method] = vi.fn().mockReturnValue(query);
    }
    query.then = vi.fn((onfulfilled: (value: unknown[]) => unknown) =>
      Promise.resolve([]).then(onfulfilled),
    );
    return query;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
  });

  describe('client-safe schemas and stubs', () => {
    it('exports all lifecycle stubs without a hard-delete operation', () => {
      expect(serverFunctions.listFeedbackSnippets).toEqual(expect.any(Function));
      expect(serverFunctions.createFeedbackSnippet).toEqual(expect.any(Function));
      expect(serverFunctions.updateFeedbackSnippet).toEqual(expect.any(Function));
      expect(serverFunctions.archiveFeedbackSnippet).toEqual(expect.any(Function));
      expect(serverFunctions.restoreFeedbackSnippet).toEqual(expect.any(Function));
      expect(serverFunctions).not.toHaveProperty('deleteFeedbackSnippet');
    });

    it('applies defaults and trims valid list input', () => {
      expect(ListFeedbackSnippetsSchema.parse({})).toEqual({ archived: false, search: '' });
      expect(ListFeedbackSnippetsSchema.parse({ archived: true, search: '  rubric  ' })).toEqual({
        archived: true,
        search: 'rubric',
      });
    });

    it('accepts exact field limits and normalizes text', () => {
      const result = CreateFeedbackSnippetSchema.safeParse({
        title: ` ${'t'.repeat(98)} `,
        category: ` ${'c'.repeat(48)} `,
        body: ` ${'b'.repeat(1998)} `,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toHaveLength(98);
        expect(result.data.category).toHaveLength(48);
        expect(result.data.body).toHaveLength(1998);
      }
    });

    it('rejects empty, over-limit, markup, and placeholder values', () => {
      expect(CreateFeedbackSnippetSchema.safeParse({ title: ' ', body: 'valid' }).success).toBe(
        false,
      );
      expect(
        CreateFeedbackSnippetSchema.safeParse({
          title: 't'.repeat(101),
          body: 'valid',
        }).success,
      ).toBe(false);
      expect(
        CreateFeedbackSnippetSchema.safeParse({
          title: 'valid',
          category: 'c'.repeat(51),
          body: 'valid',
        }).success,
      ).toBe(false);
      expect(
        CreateFeedbackSnippetSchema.safeParse({
          title: 'valid',
          body: 'b'.repeat(2001),
        }).success,
      ).toBe(false);
      expect(
        CreateFeedbackSnippetSchema.safeParse({
          title: '<strong>valid</strong>',
          body: 'valid',
        }).success,
      ).toBe(false);
      expect(
        CreateFeedbackSnippetSchema.safeParse({
          title: 'valid',
          body: 'Please review {{studentName}}.',
        }).success,
      ).toBe(false);
    });

    it('normalizes a blank optional category and validates UUID parameters', () => {
      const result = CreateFeedbackSnippetSchema.safeParse({
        title: 'Title',
        category: '  ',
        body: 'Body',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.category).toBeNull();

      expect(
        FeedbackSnippetIdSchema.safeParse({ id: '11111111-1111-4111-8111-111111111111' }).success,
      ).toBe(true);
      expect(FeedbackSnippetIdSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
      expect(
        UpdateFeedbackSnippetSchema.safeParse({
          id: 'not-a-uuid',
          title: 'Title',
          body: 'Body',
        }).success,
      ).toBe(false);
    });
  });

  describe('handler authorization and ownership', () => {
    it('rejects unauthenticated and non-instructor sessions before querying', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      expect(await listFeedbackSnippetsHandler({ data: { archived: false, search: '' } })).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      });
      expect(mockDb.select).not.toHaveBeenCalled();

      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        ...instructorSession,
        user: { ...instructorSession.user, role: 'admin' },
      } as any);
      expect(
        await createFeedbackSnippetHandler({
          data: { title: 'Title', category: null, body: 'Body' },
        }),
      ).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('returns only the current instructor active or archived results', async () => {
      mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([activeSnippet]).then(onfulfilled),
      );

      const result = await listFeedbackSnippetsHandler({
        data: { archived: false, search: '  explanation  ' },
      });

      expect(result).toEqual({ snippets: [activeSnippet] });
      expect(mockDb.select).toHaveBeenCalledOnce();
      expect(mockDb.where).toHaveBeenCalledOnce();
    });

    it('does not reveal or mutate another instructor snippet by id', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(otherInstructorSession as any);
      const result = await updateFeedbackSnippetHandler({
        data: {
          id: activeSnippet.id,
          title: 'Changed',
          category: null,
          body: 'Changed body',
        },
      });

      expect(isServerError(result)).toBe(true);
      expect(result).toEqual({
        error: { code: 'NOT_FOUND', message: 'Feedback snippet not found' },
      });
      expect(mockDb.update).toHaveBeenCalledOnce();
      expect(mockDb.where).toHaveBeenCalledOnce();
    });
  });

  describe('handler lifecycle', () => {
    it('trims and creates an owned snippet', async () => {
      mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([activeSnippet]).then(onfulfilled),
      );

      const result = await createFeedbackSnippetHandler({
        data: { title: '  Title  ', category: '  General  ', body: '  Body  ' },
      });

      expect(result).toMatchObject({ snippet: activeSnippet });
      expect(mockDb.values).toHaveBeenCalledWith({
        instructorId: 'instructor-1',
        title: 'Title',
        category: 'General',
        body: 'Body',
      });
    });

    it('updates content without changing archive state', async () => {
      mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([activeSnippet]).then(onfulfilled),
      );

      await updateFeedbackSnippetHandler({
        data: {
          id: activeSnippet.id,
          title: 'Updated title',
          category: null,
          body: 'Updated body',
        },
      });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated title', category: null, body: 'Updated body' }),
      );
      expect(mockDb.set.mock.calls[0][0]).not.toHaveProperty('archivedAt');
    });

    it('archives and restores by timestamp without deleting rows', async () => {
      mockDb.then
        .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
          Promise.resolve([{ ...activeSnippet, archivedAt: new Date() }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
          Promise.resolve([{ ...activeSnippet, archivedAt: null }]).then(onfulfilled),
        );

      await archiveFeedbackSnippetHandler({ data: { id: activeSnippet.id } });
      await restoreFeedbackSnippetHandler({ data: { id: activeSnippet.id } });

      expect(mockDb.update).toHaveBeenCalledTimes(2);
      expect(mockDb.set.mock.calls[0][0]).toEqual(
        expect.objectContaining({ archivedAt: expect.any(Date) }),
      );
      expect(mockDb.set.mock.calls[1][0]).toEqual(expect.objectContaining({ archivedAt: null }));
      expect(mockDb).not.toHaveProperty('delete');
    });
  });
});
