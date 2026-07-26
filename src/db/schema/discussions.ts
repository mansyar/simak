import {
  pgTable,
  text,
  timestamp,
  serial,
  integer,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { assignments } from './assignments';
import { checkpoints } from './assignments';

export const checkpointDiscussions = pgTable(
  'checkpoint_discussions',
  {
    id: serial('id').primaryKey(),
    checkpointId: integer('checkpoint_id')
      .notNull()
      .references(() => checkpoints.id, { onDelete: 'cascade' }),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    message: text('message').notNull(),
    parentMessageId: integer('parent_message_id').references(
      (): AnyPgColumn => checkpointDiscussions.id,
    ),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('checkpoint_discussions_checkpoint_id_created_at_idx').on(
      table.checkpointId,
      table.createdAt,
    ),
    index('checkpoint_discussions_assignment_id_created_at_idx').on(
      table.assignmentId,
      table.createdAt,
    ),
    index('checkpoint_discussions_parent_message_id_idx').on(table.parentMessageId),
  ],
);
