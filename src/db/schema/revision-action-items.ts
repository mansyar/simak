import { pgTable, text, timestamp, serial, integer, index, varchar } from 'drizzle-orm/pg-core';
import { rubricCriteria } from './rubrics';
import { reviews } from './submissions';

export const revisionActionItems = pgTable(
  'revision_action_items',
  {
    id: serial('id').primaryKey(),
    reviewId: integer('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    itemText: varchar('item_text', { length: 500 }).notNull(),
    order: integer('order').notNull(),
    criterionId: integer('criterion_id').references(() => rubricCriteria.id),
    criterionTitle: text('criterion_title'),
    addressedAt: timestamp('addressed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('revision_action_items_review_id_order_idx').on(table.reviewId, table.order),
    index('revision_action_items_review_id_addressed_at_idx').on(table.reviewId, table.addressedAt),
  ],
);
