CREATE TYPE "public"."upload_purpose" AS ENUM('submission', 'review_feedback');--> statement-breakpoint
CREATE TABLE "upload_intents" (
	"file_key" text NOT NULL,
	"user_id" text NOT NULL,
	"purpose" "upload_purpose" NOT NULL,
	"checkpoint_id" integer,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"content_type" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "upload_intents_file_key_unique" UNIQUE("file_key")
);
--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "upload_intents_user_id_idx" ON "upload_intents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upload_intents_file_key_idx" ON "upload_intents" USING btree ("file_key");