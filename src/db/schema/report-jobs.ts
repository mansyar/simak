import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { ReportJobParameters } from '@/lib/reporting-policy';
import { users } from './users';

export const reportType = pgEnum('report_type', [
  'institutional_academic_summary',
  'official_transcript',
  'analytics_summary',
]);

export const reportLocale = pgEnum('report_locale', ['en', 'id']);

export const reportJobState = pgEnum('report_job_state', [
  'pending',
  'processing',
  'completed',
  'failed',
  'expired',
]);

export const reportJobs = pgTable(
  'report_jobs',
  {
    id: serial('id').primaryKey(),
    reportType: reportType('report_type').notNull(),
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.id),
    parameters: jsonb('parameters').$type<ReportJobParameters>().notNull(),
    locale: reportLocale('locale').notNull(),
    state: reportJobState('state').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    artifactKey: text('artifact_key'),
    artifactSizeBytes: integer('artifact_size_bytes'),
    artifactSha256: text('artifact_sha256'),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    failedAt: timestamp('failed_at'),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [
    index('report_jobs_state_created_at_idx').on(table.state, table.createdAt),
    index('report_jobs_requester_created_at_idx').on(table.requesterId, table.createdAt),
    index('report_jobs_expiry_idx').on(table.state, table.expiresAt),
    check('report_jobs_attempts_nonnegative', sql`${table.attempts} >= 0`),
    check(
      'report_jobs_state_metadata_consistency',
      sql`(
        ${table.state} = 'pending'
        AND ${table.startedAt} IS NULL
        AND ${table.completedAt} IS NULL
        AND ${table.failedAt} IS NULL
        AND ${table.expiresAt} IS NULL
        AND ${table.artifactKey} IS NULL
        AND ${table.artifactSizeBytes} IS NULL
        AND ${table.artifactSha256} IS NULL
        AND ${table.failureCode} IS NULL
        AND ${table.failureMessage} IS NULL
      ) OR (
        ${table.state} = 'processing'
        AND ${table.startedAt} IS NOT NULL
        AND ${table.completedAt} IS NULL
        AND ${table.failedAt} IS NULL
        AND ${table.expiresAt} IS NULL
        AND ${table.artifactKey} IS NULL
        AND ${table.artifactSizeBytes} IS NULL
        AND ${table.artifactSha256} IS NULL
        AND ${table.failureCode} IS NULL
        AND ${table.failureMessage} IS NULL
      ) OR (
        ${table.state} = 'completed'
        AND ${table.startedAt} IS NOT NULL
        AND ${table.completedAt} IS NOT NULL
        AND ${table.failedAt} IS NULL
        AND ${table.expiresAt} IS NOT NULL
        AND ${table.artifactKey} IS NOT NULL
        AND ${table.artifactSizeBytes} > 0
        AND ${table.artifactSha256} IS NOT NULL
        AND ${table.failureCode} IS NULL
        AND ${table.failureMessage} IS NULL
      ) OR (
        ${table.state} = 'failed'
        AND ${table.startedAt} IS NOT NULL
        AND ${table.completedAt} IS NULL
        AND ${table.failedAt} IS NOT NULL
        AND ${table.expiresAt} IS NULL
        AND ${table.artifactKey} IS NULL
        AND ${table.artifactSizeBytes} IS NULL
        AND ${table.artifactSha256} IS NULL
        AND ${table.failureCode} IS NOT NULL
        AND ${table.failureMessage} IS NOT NULL
      ) OR (
        ${table.state} = 'expired'
        AND ${table.startedAt} IS NOT NULL
        AND ${table.completedAt} IS NOT NULL
        AND ${table.failedAt} IS NULL
        AND ${table.expiresAt} IS NOT NULL
        AND ${table.failureCode} IS NULL
        AND ${table.failureMessage} IS NULL
        AND (
          (
            ${table.artifactKey} IS NULL
            AND ${table.artifactSizeBytes} IS NULL
            AND ${table.artifactSha256} IS NULL
          ) OR (
            ${table.artifactKey} IS NOT NULL
            AND ${table.artifactSizeBytes} > 0
            AND ${table.artifactSha256} IS NOT NULL
          )
        )
      )`,
    ),
  ],
);
