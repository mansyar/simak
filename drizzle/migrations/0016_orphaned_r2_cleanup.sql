-- Add cleanedUpAt column to upload_intents for tracking R2 orphan cleanup
ALTER TABLE "upload_intents" ADD COLUMN "cleaned_up_at" timestamp;
