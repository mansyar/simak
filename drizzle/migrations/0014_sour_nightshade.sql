CREATE TABLE "checkpoint_discussions" (
	"id" serial PRIMARY KEY NOT NULL,
	"checkpoint_id" integer NOT NULL,
	"assignment_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"message" text NOT NULL,
	"parent_message_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "checkpoint_discussions" ADD CONSTRAINT "checkpoint_discussions_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoint_discussions" ADD CONSTRAINT "checkpoint_discussions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoint_discussions" ADD CONSTRAINT "checkpoint_discussions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoint_discussions" ADD CONSTRAINT "checkpoint_discussions_parent_message_id_checkpoint_discussions_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."checkpoint_discussions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkpoint_discussions_checkpoint_id_created_at_idx" ON "checkpoint_discussions" USING btree ("checkpoint_id","created_at");--> statement-breakpoint
CREATE INDEX "checkpoint_discussions_assignment_id_created_at_idx" ON "checkpoint_discussions" USING btree ("assignment_id","created_at");--> statement-breakpoint
CREATE INDEX "checkpoint_discussions_parent_message_id_idx" ON "checkpoint_discussions" USING btree ("parent_message_id");