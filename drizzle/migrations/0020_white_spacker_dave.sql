CREATE TABLE "calendar_feed_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "calendar_feed_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "calendar_feed_tokens" ADD CONSTRAINT "calendar_feed_tokens_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_feed_tokens_student_id_idx" ON "calendar_feed_tokens" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feed_tokens_active_student_unq" ON "calendar_feed_tokens" USING btree ("student_id") WHERE "calendar_feed_tokens"."revoked_at" IS NULL;