import { pgTable, text, timestamp, serial, integer, index, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';

export const gradingType = pgEnum('grading_type', ['numeric', 'qualitative']);

export const assignmentTemplates = pgTable(
  'assignment_templates',
  {
    id: serial('id').primaryKey(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('assignment_templates_name_trgm_idx').using('gin', table.name.op('gin_trgm_ops')),
  ],
);

export const templateCheckpoints = pgTable(
  'template_checkpoints',
  {
    id: serial('id').primaryKey(),
    templateId: integer('template_id')
      .notNull()
      .references(() => assignmentTemplates.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    order: integer('order').notNull(),
    minConsultations: integer('min_consultations').default(0),
    estimatedDuration: integer('estimated_duration').default(0),
    gradingType: gradingType('grading_type'),
    createdAt: timestamp('created_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('template_checkpoints_template_id_order_idx').on(table.templateId, table.order),
  ],
);
