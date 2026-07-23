CREATE TABLE "deadline_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"checkpoint_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"tier" text NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	CONSTRAINT "deadline_reminders_checkpoint_id_tier_unq" UNIQUE("checkpoint_id","tier")
);
--> statement-breakpoint
ALTER TABLE "deadline_reminders" ADD CONSTRAINT "deadline_reminders_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_reminders" ADD CONSTRAINT "deadline_reminders_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkpoints_state_due_date_idx" ON "checkpoints" USING btree ("state","due_date");