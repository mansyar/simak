-- Rollback for 0001_email_queue_processing_status.sql
-- Reverts the CHECK constraint addition (restores status to pending/sent/failed).
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0001_email_queue_processing_status.rollback.sql
ALTER TABLE "email_queue" DROP CONSTRAINT IF EXISTS "email_queue_status_check";
