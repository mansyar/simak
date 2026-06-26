ALTER TABLE "notifications" ADD COLUMN "title_key" varchar(255);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "message_key" varchar(255);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "params" jsonb;