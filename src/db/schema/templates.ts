import { pgTable, text, timestamp, serial, integer } from 'drizzle-orm/pg-core';
import { users } from './users';

export const assignmentTemplates = pgTable('assignment_templates', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const templateCheckpoints = pgTable('template_checkpoints', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id')
    .notNull()
    .references(() => assignmentTemplates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  order: integer('order').notNull(),
  minConsultations: integer('min_consultations').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});
