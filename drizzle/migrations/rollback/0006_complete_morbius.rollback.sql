-- Rollback for 0006_complete_morbius.sql
-- Reverts the upload_intents table, its foreign keys/indexes, and the upload_purpose enum.
-- Note: Run before 0007 rollback is not required (0007 only alters NOT NULL on this table's
-- columns). This rollback drops the table entirely, so run it after 0007's rollback if both
-- are applied together.
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0006_complete_morbius.rollback.sql

-- Drop indexes
DROP INDEX IF EXISTS "upload_intents_file_key_idx";
DROP INDEX IF EXISTS "upload_intents_user_id_idx";

-- Drop foreign key constraints
ALTER TABLE "upload_intents" DROP CONSTRAINT IF EXISTS "upload_intents_checkpoint_id_checkpoints_id_fk";
ALTER TABLE "upload_intents" DROP CONSTRAINT IF EXISTS "upload_intents_user_id_users_id_fk";

-- Drop table (also drops the inline unique constraint and columns)
DROP TABLE IF EXISTS "upload_intents";

-- Drop enum type
DROP TYPE IF EXISTS "upload_purpose";
