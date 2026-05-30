-- Create email_queue table for async email delivery
CREATE TABLE "email_queue" (
	"id" serial PRIMARY KEY,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"template_type" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0,
	"last_attempt_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "email_queue_status_created_at_idx" ON "email_queue" ("status", "created_at");
