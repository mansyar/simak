-- Rollback for 0007_cool_tag.sql
-- Restores the NOT NULL constraints on upload_intents.file_name and upload_intents.file_size
-- that 0007 dropped. Run before the 0006 rollback (which drops the table entirely).
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0007_cool_tag.rollback.sql

-- Restore NOT NULL constraints (original state per 0006 migration)
ALTER TABLE "upload_intents" ALTER COLUMN "file_name" SET NOT NULL;
ALTER TABLE "upload_intents" ALTER COLUMN "file_size" SET NOT NULL;
