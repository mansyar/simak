/**
 * Database reset utility for E2E tests.
 *
 * Truncates all application tables (except `__drizzle_migrations`) and
 * re-runs the E2E seed script to restore deterministic test data.
 *
 * Usage: Call `resetDatabase()` in a `beforeAll` hook or Playwright fixture
 * before each spec file to ensure data isolation.
 */
import postgres from 'postgres';
import { execSync } from 'node:child_process';

/**
 * All application tables to truncate (excluding drizzle migrations).
 * Order doesn't matter — we use CASCADE.
 */
export const TABLES_TO_TRUNCATE = [
  'appointment_reminders',
  'appointments',
  'calendar_feed_tokens',
  'email_queue',
  'feedback_snippets',
  'audit_log',
  'academic_records',
  'academic_record_policies',
  'risk_observations',
  'interventions',
  'notifications',
  'extension_requests',
  'consultations',
  'checkpoint_discussions',
  'upload_intents',
  'revision_action_items',
  'review_scores',
  'reviews',
  'submissions',
  'grade_release_snapshots',
  'final_grades',
  'assignment_grade_config',
  'checkpoints',
  'rubric_criteria',
  'rubric_levels',
  'section_enrollments',
  'course_sections',
  'courses',
  'academic_terms',
  'assignment_students',
  'assignments',
  'template_checkpoints',
  'assignment_templates',
  'two_factor',
  'verification',
  'account',
  'session',
  'users',
];

/**
 * Get the E2E test database URL from the environment.
 * Throws if DATABASE_URL is not set (set by playwright.config.ts E2E_ENV).
 */
export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required for E2E tests.');
  }
  return databaseUrl;
}

/**
 * Truncate all application tables and re-seed the test database.
 *
 * Connects directly to the test DB using DATABASE_URL from process.env
 * (set by playwright.config.ts E2E_ENV).
 */
export async function resetDatabase(): Promise<void> {
  const sql = postgres(getDatabaseUrl());

  try {
    // Truncate all tables in one statement with CASCADE
    const truncateQuery = `TRUNCATE ${TABLES_TO_TRUNCATE.join(', ')} CASCADE;`;
    await sql.unsafe(truncateQuery);
    console.log('[E2E DB Reset] All tables truncated.');
  } finally {
    await sql.end();
  }

  // Re-run the E2E seed script
  execSync('npx tsx scripts/seed-e2e.ts', {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('[E2E DB Reset] Database re-seeded.');
}
