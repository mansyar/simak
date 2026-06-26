ALTER TABLE "notifications" ALTER COLUMN "title_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "message_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "message";