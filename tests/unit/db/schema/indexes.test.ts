/** @vitest-environment node */
import { describe, it, expect } from 'vitest';

// Drizzle internal symbols (not exposed in .d.ts but stable at runtime)
const EXTRA_CONFIG_BUILDER = Symbol.for('drizzle:ExtraConfigBuilder');
const EXTRA_CONFIG_COLUMNS = Symbol.for('drizzle:ExtraConfigColumns');
const ENTITY_KIND = Symbol.for('drizzle:entityKind');

type IndexInfo = { name: string; columns: string[] };

/**
 * Extracts index declarations from a Drizzle table's extra config builder.
 * Returns an array of { name, columns } for each declared index.
 */
function getIndexes(table: Record<symbol, unknown>): IndexInfo[] {
  const builder = table[EXTRA_CONFIG_BUILDER] as
    | ((cols: Record<string, unknown>) => unknown[])
    | undefined;
  const extraConfigColumns = table[EXTRA_CONFIG_COLUMNS] as Record<string, unknown>;
  if (!builder || !extraConfigColumns) return [];
  const config = builder(extraConfigColumns);
  if (!Array.isArray(config)) return [];
  return config
    .filter((item): item is { config: { name?: string; columns: { name: string }[] } } => {
      if (item == null || typeof item !== 'object') return false;
      const ctor = (item as { constructor: Record<symbol, unknown> }).constructor;
      return ctor?.[ENTITY_KIND] === 'PgIndexBuilder' && 'config' in item;
    })
    .map((item) => ({
      name: item.config.name ?? '',
      columns: item.config.columns.map((col) => col.name),
    }));
}

function expectIndex(table: Record<symbol, unknown>, name: string, columns: string[]): void {
  const indexes = getIndexes(table);
  const index = indexes.find((i) => i.name === name);
  expect(index, `Index '${name}' not found`).toBeDefined();
  expect(index?.columns).toEqual(columns);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function asTable(table: any): Record<symbol, unknown> {
  return table;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('Database indexes — PERF-7 through PERF-14', () => {
  // PERF-7: assignmentStudents (currently ZERO indexes)
  it('assignmentStudents has (assignmentId, studentId) composite index', async () => {
    const { assignmentStudents } = await import('@/db/schema/assignments');
    expectIndex(asTable(assignmentStudents), 'assignment_students_assignment_id_student_id_idx', [
      'assignment_id',
      'student_id',
    ]);
  });

  it('assignmentStudents has (studentId) index', async () => {
    const { assignmentStudents } = await import('@/db/schema/assignments');
    expectIndex(asTable(assignmentStudents), 'assignment_students_student_id_idx', ['student_id']);
  });

  // PERF-8: notifications
  it('notifications has (createdAt) index', async () => {
    const { notifications } = await import('@/db/schema/notifications');
    expectIndex(asTable(notifications), 'notifications_created_at_idx', ['created_at']);
  });

  it('notifications retains existing (userId, read) index', async () => {
    const { notifications } = await import('@/db/schema/notifications');
    expectIndex(asTable(notifications), 'notifications_user_id_read_idx', ['user_id', 'read']);
  });

  // PERF-9: templateCheckpoints (currently ZERO indexes)
  it('templateCheckpoints has (templateId, order) index', async () => {
    const { templateCheckpoints } = await import('@/db/schema/templates');
    expectIndex(asTable(templateCheckpoints), 'template_checkpoints_template_id_order_idx', [
      'template_id',
      'order',
    ]);
  });

  // PERF-10: users (currently ZERO indexes)
  it('users has (role, deletedAt) index', async () => {
    const { users } = await import('@/db/schema/users');
    expectIndex(asTable(users), 'users_role_deleted_at_idx', ['role', 'deleted_at']);
  });

  // PERF-11: consultations (REPLACE status → assignmentId+status)
  it('consultations has (assignmentId, status) composite index', async () => {
    const { consultations } = await import('@/db/schema/consultations');
    expectIndex(asTable(consultations), 'consultations_assignment_id_status_idx', [
      'assignment_id',
      'status',
    ]);
  });

  it('consultations no longer has standalone (status) index', async () => {
    const { consultations } = await import('@/db/schema/consultations');
    const indexes = getIndexes(asTable(consultations));
    expect(indexes.find((i) => i.name === 'consultations_status_idx')).toBeUndefined();
  });

  it('consultations retains existing (checkpointId) index', async () => {
    const { consultations } = await import('@/db/schema/consultations');
    expectIndex(asTable(consultations), 'consultations_checkpoint_id_idx', ['checkpoint_id']);
  });

  // PERF-12: extensionRequests
  it('extensionRequests has (assignmentId, studentId) index', async () => {
    const { extensionRequests } = await import('@/db/schema/extensions');
    expectIndex(asTable(extensionRequests), 'extension_requests_assignment_id_student_id_idx', [
      'assignment_id',
      'student_id',
    ]);
  });

  it('extensionRequests retains existing (assignmentId, status) index', async () => {
    const { extensionRequests } = await import('@/db/schema/extensions');
    expectIndex(asTable(extensionRequests), 'extension_requests_assignment_id_status_idx', [
      'assignment_id',
      'status',
    ]);
  });

  // PERF-13: auditLog
  it('auditLog has (actorId) index', async () => {
    const { auditLog } = await import('@/db/schema/audit-log');
    expectIndex(asTable(auditLog), 'audit_log_actor_id_idx', ['actor_id']);
  });

  it('auditLog retains existing (createdAt) index', async () => {
    const { auditLog } = await import('@/db/schema/audit-log');
    expectIndex(asTable(auditLog), 'audit_log_created_at_idx', ['created_at']);
  });

  // PERF-14: reviews (REPLACE submissionId → submissionId+createdAt)
  it('reviews has (submissionId, createdAt) composite index', async () => {
    const { reviews } = await import('@/db/schema/submissions');
    expectIndex(asTable(reviews), 'reviews_submission_id_created_at_idx', [
      'submission_id',
      'created_at',
    ]);
  });

  it('reviews no longer has standalone (submissionId) index', async () => {
    const { reviews } = await import('@/db/schema/submissions');
    const indexes = getIndexes(asTable(reviews));
    expect(indexes.find((i) => i.name === 'reviews_submission_id_idx')).toBeUndefined();
  });
});
