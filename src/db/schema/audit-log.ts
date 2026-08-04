import { pgTable, serial, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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
    index('audit_log_actor_id_idx').on(table.actorId),
    index('audit_log_entity_id_trgm_idx').using('gin', table.entityId.op('gin_trgm_ops')),
    index('audit_log_details_trgm_idx').using(
      'gin',
      sql`(CAST(${table.details} AS text)) gin_trgm_ops`,
    ),
  ],
);
