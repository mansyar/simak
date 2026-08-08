ALTER TABLE "appointment_reminders" ALTER COLUMN "sent_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ALTER COLUMN "sent_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD COLUMN "claimed_at" timestamp with time zone DEFAULT now() NOT NULL;