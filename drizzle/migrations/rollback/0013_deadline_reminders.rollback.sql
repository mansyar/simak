-- Rollback for 0010_deadline_reminders.sql
-- Reverts the deadline_reminders table and checkpoints_state_due_date_idx index.
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0010_deadline_reminders.rollback.sql
DROP INDEX IF EXISTS "checkpoints_state_due_date_idx";
DROP TABLE IF EXISTS "deadline_reminders";
