CREATE TYPE "public"."appointment_reminder_tier" AS ENUM('24h', '1h');--> statement-breakpoint
CREATE TABLE "appointment_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"participant_id" text NOT NULL,
	"tier" "appointment_reminder_tier" NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_reminders_appointment_participant_tier_unq" UNIQUE("appointment_id","participant_id","tier")
);
--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_reminders_appointment_tier_idx" ON "appointment_reminders" USING btree ("appointment_id","tier");--> statement-breakpoint
CREATE INDEX "appointment_reminders_participant_tier_idx" ON "appointment_reminders" USING btree ("participant_id","tier");