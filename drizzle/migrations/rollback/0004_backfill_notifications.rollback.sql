-- Rollback for 0004_backfill_notifications.sql
-- Reverts the backfill by clearing the copied key values.
-- Note: legacy notifications will lose their title/message text in key columns.
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0004_backfill_notifications.rollback.sql
UPDATE notifications
SET title_key = NULL,
    message_key = NULL,
    params = NULL;
