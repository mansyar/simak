-- Rollback for migration 0016: orphaned R2 object cleanup
ALTER TABLE "upload_intents" DROP COLUMN IF EXISTS "cleaned_up_at";
