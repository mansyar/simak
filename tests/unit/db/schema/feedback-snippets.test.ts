import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Feedback snippets schema', () => {
  it('exports the feedbackSnippets table', async () => {
    const mod = await import('@/db/schema/feedback-snippets');

    expect(mod).toHaveProperty('feedbackSnippets');
  });

  it('defines the required columns and bounds', async () => {
    const { feedbackSnippets } = await import('@/db/schema/feedback-snippets');

    expect(feedbackSnippets).toHaveProperty('id');
    expect(feedbackSnippets).toHaveProperty('instructorId');
    expect(feedbackSnippets).toHaveProperty('title');
    expect(feedbackSnippets).toHaveProperty('category');
    expect(feedbackSnippets).toHaveProperty('body');
    expect(feedbackSnippets).toHaveProperty('archivedAt');
    expect(feedbackSnippets).toHaveProperty('createdAt');
    expect(feedbackSnippets).toHaveProperty('updatedAt');

    expect(feedbackSnippets.title.columnType).toBe('PgVarchar');
    expect(feedbackSnippets.title.length).toBe(100);
    expect(feedbackSnippets.title.notNull).toBe(true);

    expect(feedbackSnippets.category.columnType).toBe('PgVarchar');
    expect(feedbackSnippets.category.length).toBe(50);
    expect(feedbackSnippets.category.notNull).toBe(false);

    expect(feedbackSnippets.body.columnType).toBe('PgVarchar');
    expect(feedbackSnippets.body.length).toBe(2000);
    expect(feedbackSnippets.body.notNull).toBe(true);
  });

  it('uses an instructor foreign key and an owner/archive index', async () => {
    const { feedbackSnippets } = await import('@/db/schema/feedback-snippets');
    const config = getTableConfig(feedbackSnippets);
    const foreignKey = config.foreignKeys.find((key) => {
      const reference = key.reference();
      return (
        reference.foreignTable[Symbol.for('drizzle:Name')] === 'users' &&
        reference.columns[0]?.name === 'instructor_id' &&
        reference.foreignColumns[0]?.name === 'id'
      );
    });
    const ownerArchiveIndex = config.indexes.find(
      (index) => index.config.name === 'feedback_snippets_instructor_archived_idx',
    );

    expect(foreignKey).toBeDefined();
    expect(ownerArchiveIndex?.config.columns.map((column) => column.name)).toEqual([
      'instructor_id',
      'archived_at',
    ]);
  });

  it('is re-exported with its relations from the schema barrel', async () => {
    const mod = await import('@/db/schema/index');

    expect(mod).toHaveProperty('feedbackSnippets');
    expect(mod).toHaveProperty('feedbackSnippetsRelations');
  });
});
