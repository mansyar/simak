import { pgTable, serial, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    details: jsonb('details'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('audit_log_created_at_idx').on(table.createdAt),
    index('audit_log_action_idx').on(table.action),
    index('audit_log_entity_type_entity_id_idx').on(table.entityType, table.entityId),
  ],
);
