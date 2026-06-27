-- Rollback for 0003_wonderful_quicksilver.sql
-- Reverts the addition of title_key, message_key, and params columns.
-- Note: data in these columns will be lost. Run 0005 and 0004 rollbacks first.
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0003_wonderful_quicksilver.rollback.sql
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "title_key";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "message_key";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "params";
