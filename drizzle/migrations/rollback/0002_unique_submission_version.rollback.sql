-- Rollback for 0002_unique_submission_version.sql
-- Reverts the addition of the UNIQUE (checkpoint_id, version) constraint.
-- Note: rows deleted during the forward migration cannot be restored.
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0002_unique_submission_version.rollback.sql
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_checkpoint_version_unq";
