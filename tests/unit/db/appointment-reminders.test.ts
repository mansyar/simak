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

function findReminderMigration(): string | null {
  return (
    readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => resolve(migrationsDir, file))
      .find((file) =>
        readFileSync(file, 'utf8').includes('CREATE TABLE "appointment_reminders"'),
      ) ?? null
  );
}

describe('appointment reminders schema', () => {
  it('defines the reminder tier contract and participant references', async () => {
    const { appointmentReminders, appointmentReminderTier } =
      await import('@/db/schema/appointment-reminders');

    expect(appointmentReminders).toHaveProperty('appointmentId');
    expect(appointmentReminders).toHaveProperty('participantId');
    expect(appointmentReminders).toHaveProperty('tier');
    expect(appointmentReminders).toHaveProperty('sentAt');
    expect(appointmentReminderTier.enumValues).toEqual(['24h', '1h']);
    expect(appointmentReminders.appointmentId.notNull).toBe(true);
    expect(appointmentReminders.participantId.notNull).toBe(true);
    expect(appointmentReminders.tier.notNull).toBe(true);
    expect(appointmentReminders.sentAt.hasDefault).toBe(true);
    expect(foreignTableNames(appointmentReminders)).toEqual(
      expect.arrayContaining(['appointments', 'users']),
    );
  });

  it('defines participant-tier deduplication and lookup indexes', async () => {
    const { appointmentReminders } = await import('@/db/schema/appointment-reminders');
    const config = tableConfig(appointmentReminders);

    expect(config.uniqueConstraints.map((constraint) => constraint.name)).toContain(
      'appointment_reminders_appointment_participant_tier_unq',
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        'appointment_reminders_appointment_tier_idx',
        'appointment_reminders_participant_tier_idx',
      ]),
    );
  });
});

describe('appointment reminders migration contract', () => {
  it('creates the table with unique participant-tier deduplication and foreign keys', () => {
    const migrationPath = findReminderMigration();
    expect(migrationPath).not.toBeNull();

    const sql = readFileSync(migrationPath!, 'utf8');
    expect(sql).toMatch(/CREATE TABLE "appointment_reminders"/i);
    expect(sql).toMatch(/"appointment_id" integer NOT NULL/i);
    expect(sql).toMatch(/"participant_id" text NOT NULL/i);
    expect(sql).toContain('appointment_reminders_appointment_participant_tier_unq');
    expect(sql).toMatch(/FOREIGN KEY.*"appointment_id".*REFERENCES.*"appointments"/is);
    expect(sql).toMatch(/FOREIGN KEY.*"participant_id".*REFERENCES.*"users"/is);
  });

  it('has a companion rollback that removes indexes and the reminder table', () => {
    const migrationPath = findReminderMigration();
    expect(migrationPath).not.toBeNull();

    const rollbackPath = resolve(
      rollbackDir,
      `${basename(migrationPath!).replace(/\.sql$/, '')}.rollback.sql`,
    );
    expect(existsSync(rollbackPath)).toBe(true);

    const sql = readFileSync(rollbackPath, 'utf8');
    expect(sql).toContain('DROP TABLE IF EXISTS "appointment_reminders"');
    expect(sql).toContain('appointment_reminders_appointment_tier_idx');
    expect(sql).toContain('appointment_reminders_participant_tier_idx');
  });
});
