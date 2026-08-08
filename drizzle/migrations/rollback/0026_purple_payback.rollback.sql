UPDATE "appointment_reminders"
SET "sent_at" = COALESCE("sent_at", "claimed_at", now())
WHERE "sent_at" IS NULL;
ALTER TABLE "appointment_reminders" DROP COLUMN IF EXISTS "claimed_at";
ALTER TABLE "appointment_reminders" ALTER COLUMN "sent_at" SET DEFAULT now();
ALTER TABLE "appointment_reminders" ALTER COLUMN "sent_at" SET NOT NULL;
