ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_status_check" CHECK ("status" IN ('pending', 'processing', 'sent', 'failed'));

-- Rollback:
-- ALTER TABLE "email_queue" DROP CONSTRAINT "email_queue_status_check";
