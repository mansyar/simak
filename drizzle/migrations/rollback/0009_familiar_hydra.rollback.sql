-- Rollback for 0009_familiar_hydra.sql
-- Reverts the resendMessageId column addition.
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0009_familiar_hydra.rollback.sql
ALTER TABLE "email_queue" DROP COLUMN IF EXISTS "resend_message_id";
