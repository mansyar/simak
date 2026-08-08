import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const migrationsDir = resolve(process.cwd(), 'drizzle/migrations');
const rollbackDir = resolve(migrationsDir, 'rollback');

function tableConfig(table: unknown) {
  return getTableConfig(table as Parameters<typeof getTableConfig>[0]);
}

function foreignTableNames(table: unknown): string[] {
  return tableConfig(table).foreignKeys.map((key) => {
    const reference = key.reference();
    return (reference.foreignTable as unknown as { [key: symbol]: string })[
      Symbol.for('drizzle:Name')
    ];
  });
}

function getIndexes(table: unknown): Array<{ name: string; columns: string[] }> {
  const config = tableConfig(table);
  return config.indexes.map((index) => ({
    name: index.config.name ?? '',
    columns: index.config.columns.flatMap((column) => {
      if (column && typeof column === 'object' && 'name' in column) {
        return typeof column.name === 'string' ? [column.name] : [];
      }

      return [];
    }),
  }));
}

function findAppointmentMigration(): string | null {
  const migration = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => resolve(migrationsDir, file))
    .find((file) => readFileSync(file, 'utf8').includes('CREATE TABLE "appointments"'));

  return migration ?? null;
}

function findAppointmentConsistencyMigration(): string | null {
  const migration = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => resolve(migrationsDir, file))
    .find((file) => readFileSync(file, 'utf8').includes('appointments_status_student_check'));

  return migration ?? null;
}

describe('appointments schema', () => {
  it('exports the appointment table and lifecycle enum', async () => {
    const { appointments, appointmentStatus } = await import('@/db/schema/appointments');

    expect(appointments).toHaveProperty('id');
    expect(appointmentStatus.enumValues).toEqual([
      'available',
      'booked',
      'cancelled',
      'completed',
      'no_show',
    ]);
  });

  it('defines booking participants, academic context, UTC instants, and lifecycle fields', async () => {
    const { appointments } = await import('@/db/schema/appointments');

    expect(appointments).toHaveProperty('assignmentId');
    expect(appointments).toHaveProperty('checkpointId');
    expect(appointments).toHaveProperty('instructorId');
    expect(appointments).toHaveProperty('studentId');
    expect(appointments).toHaveProperty('startAt');
    expect(appointments).toHaveProperty('endAt');
    expect(appointments).toHaveProperty('status');
    expect(appointments).toHaveProperty('createdAt');
    expect(appointments).toHaveProperty('updatedAt');

    expect(appointments.assignmentId.notNull).toBe(true);
    expect(appointments.checkpointId.notNull).toBe(false);
    expect(appointments.instructorId.notNull).toBe(true);
    expect(appointments.studentId.notNull).toBe(false);
    expect(appointments.startAt.notNull).toBe(true);
    expect(appointments.endAt.notNull).toBe(true);
    expect(appointments.startAt.getSQLType()).toBe('timestamp with time zone');
    expect(appointments.endAt.getSQLType()).toBe('timestamp with time zone');
    expect(appointments.status.notNull).toBe(true);
    expect(appointments.status.hasDefault).toBe(true);
    expect(foreignTableNames(appointments)).toEqual(
      expect.arrayContaining(['assignments', 'checkpoints', 'users']),
    );
  });

  it('defines time-range checks and participant/status indexes', async () => {
    const { appointments } = await import('@/db/schema/appointments');
    const config = tableConfig(appointments);
    const checkNames = config.checks.map((check) => check.name);

    expect(checkNames).toEqual(
      expect.arrayContaining([
        'appointments_time_order_check',
        'appointments_duration_range_check',
        'appointments_status_student_check',
      ]),
    );

    const indexes = getIndexes(appointments);
    expect(indexes).toEqual(
      expect.arrayContaining([
        {
          name: 'appointments_assignment_status_start_at_idx',
          columns: ['assignment_id', 'status', 'start_at'],
        },
        {
          name: 'appointments_instructor_status_start_at_idx',
          columns: ['instructor_id', 'status', 'start_at'],
        },
        {
          name: 'appointments_student_status_start_at_idx',
          columns: ['student_id', 'status', 'start_at'],
        },
      ]),
    );
  });
});

describe('appointments migration contract', () => {
  it('creates the appointment table with UTC timestamp columns and constraints', () => {
    const migrationPath = findAppointmentMigration();
    expect(migrationPath).not.toBeNull();

    const sql = readFileSync(migrationPath!, 'utf8');
    expect(sql).toMatch(
      /CREATE TYPE .*appointment_status.*available.*booked.*cancelled.*completed.*no_show/is,
    );
    expect(sql).toMatch(/"start_at" timestamp with time zone NOT NULL/i);
    expect(sql).toMatch(/"end_at" timestamp with time zone NOT NULL/i);
    expect(sql).toContain('appointments_time_order_check');
    expect(sql).toContain('appointments_duration_range_check');
    expect(sql).toMatch(/FOREIGN KEY.*"assignment_id".*REFERENCES.*"assignments"/is);
    expect(sql).toMatch(/FOREIGN KEY.*"checkpoint_id".*REFERENCES.*"checkpoints"/is);
    expect(sql).toMatch(/FOREIGN KEY.*"instructor_id".*REFERENCES.*"users"/is);
    expect(sql).toMatch(/FOREIGN KEY.*"student_id".*REFERENCES.*"users"/is);

    const consistencyMigrationPath = findAppointmentConsistencyMigration();
    expect(consistencyMigrationPath).not.toBeNull();
    expect(readFileSync(consistencyMigrationPath!, 'utf8')).toContain(
      'appointments_status_student_check',
    );
  });

  it('has a companion rollback that removes appointment indexes, table, and enum', () => {
    const migrationPath = findAppointmentMigration();
    expect(migrationPath).not.toBeNull();

    const rollbackPath = resolve(
      rollbackDir,
      `${basename(migrationPath!).replace(/\.sql$/, '')}.rollback.sql`,
    );
    expect(existsSync(rollbackPath)).toBe(true);

    const sql = readFileSync(rollbackPath, 'utf8');
    expect(sql).toContain('DROP TABLE IF EXISTS "appointments"');
    expect(sql).toContain('DROP TYPE IF EXISTS "public"."appointment_status"');
    expect(sql).toContain('appointments_assignment_status_start_at_idx');
    expect(sql).toContain('appointments_instructor_status_start_at_idx');
    expect(sql).toContain('appointments_student_status_start_at_idx');
  });
});
