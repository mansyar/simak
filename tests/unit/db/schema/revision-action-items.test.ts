import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Revision action items schema', () => {
  it('exports the revisionActionItems table', async () => {
    const mod = await import('@/db/schema/revision-action-items');

    expect(mod).toHaveProperty('revisionActionItems');
  });

  it('defines immutable item fields and addressed-status fields', async () => {
    const { revisionActionItems } = await import('@/db/schema/revision-action-items');

    expect(revisionActionItems).toHaveProperty('id');
    expect(revisionActionItems).toHaveProperty('reviewId');
    expect(revisionActionItems).toHaveProperty('itemText');
    expect(revisionActionItems).toHaveProperty('order');
    expect(revisionActionItems).toHaveProperty('criterionId');
    expect(revisionActionItems).toHaveProperty('criterionTitle');
    expect(revisionActionItems).toHaveProperty('addressedAt');
    expect(revisionActionItems).toHaveProperty('createdAt');
    expect(revisionActionItems).toHaveProperty('updatedAt');

    expect(revisionActionItems.itemText.columnType).toBe('PgVarchar');
    expect((revisionActionItems.itemText as any).length).toBe(500);
    expect(revisionActionItems.itemText.notNull).toBe(true);
    expect(revisionActionItems.order.notNull).toBe(true);
    expect(revisionActionItems.criterionId.notNull).toBe(false);
    expect(revisionActionItems.criterionTitle.notNull).toBe(false);
    expect(revisionActionItems.addressedAt.notNull).toBe(false);
  });

  it('references reviews and optional rubric criteria', async () => {
    const { revisionActionItems } = await import('@/db/schema/revision-action-items');
    const config = getTableConfig(revisionActionItems);
    const references = config.foreignKeys.map((key) => {
      const reference = key.reference();
      return {
        table: (reference.foreignTable as any)[Symbol.for('drizzle:Name')],
        from: reference.columns[0]?.name,
        to: reference.foreignColumns[0]?.name,
      };
    });

    expect(references).toEqual(
      expect.arrayContaining([
        { table: 'reviews', from: 'review_id', to: 'id' },
        { table: 'rubric_criteria', from: 'criterion_id', to: 'id' },
      ]),
    );
  });

  it('defines review-order and review-status indexes', async () => {
    const { revisionActionItems } = await import('@/db/schema/revision-action-items');
    const config = getTableConfig(revisionActionItems);
    const indexes = new Map(
      config.indexes.map((index) => [
        index.config.name,
        index.config.columns.map((column) => (column as any).name),
      ]),
    );

    expect(indexes.get('revision_action_items_review_id_order_idx')).toEqual([
      'review_id',
      'order',
    ]);
    expect(indexes.get('revision_action_items_review_id_addressed_at_idx')).toEqual([
      'review_id',
      'addressed_at',
    ]);
  });

  it('is re-exported with its relations from the schema barrel', async () => {
    const mod = await import('@/db/schema/index');

    expect(mod).toHaveProperty('revisionActionItems');
    expect(mod).toHaveProperty('revisionActionItemsRelations');
  });
});
