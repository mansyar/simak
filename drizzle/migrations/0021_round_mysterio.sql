CREATE TABLE "revision_action_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"item_text" varchar(500) NOT NULL,
	"order" integer NOT NULL,
	"criterion_id" integer,
	"criterion_title" text,
	"addressed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "revision_action_items" ADD CONSTRAINT "revision_action_items_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_action_items" ADD CONSTRAINT "revision_action_items_criterion_id_rubric_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."rubric_criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "revision_action_items_review_id_order_idx" ON "revision_action_items" USING btree ("review_id","order");--> statement-breakpoint
CREATE INDEX "revision_action_items_review_id_addressed_at_idx" ON "revision_action_items" USING btree ("review_id","addressed_at");