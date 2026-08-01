CREATE TABLE "feedback_snippets" (
	"id" text PRIMARY KEY NOT NULL,
	"instructor_id" text NOT NULL,
	"title" varchar(100) NOT NULL,
	"category" varchar(50),
	"body" varchar(2000) NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
-- cleaned_up_at is already added by migration 0016_orphaned_r2_cleanup.sql.
ALTER TABLE "feedback_snippets" ADD CONSTRAINT "feedback_snippets_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_snippets_instructor_archived_idx" ON "feedback_snippets" USING btree ("instructor_id","archived_at");
