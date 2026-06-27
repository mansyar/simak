-- Rollback for 0005_odd_wrecker.sql
-- Reverts the NOT NULL constraints and restores the original title/message columns.
-- Note: Run before 0004 and 0003 rollbacks. Re-adds title (text NOT NULL) and message (text).
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0005_odd_wrecker.rollback.sql

-- Drop NOT NULL constraints on key columns (restores nullable state from 0003)
ALTER TABLE "notifications" ALTER COLUMN "title_key" DROP NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "message_key" DROP NOT NULL;

-- Re-add the original columns (nullable first for safe backfill)
ALTER TABLE "notifications" ADD COLUMN "title" text;
ALTER TABLE "notifications" ADD COLUMN "message" text;

-- Copy key values back to original columns
UPDATE notifications
SET title = title_key,
    message = message_key;

-- Restore NOT NULL on title (original state per 0000 migration)
ALTER TABLE "notifications" ALTER COLUMN "title" SET NOT NULL;
