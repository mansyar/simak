CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "users_name_trgm_idx" ON "users" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "users_email_trgm_idx" ON "users" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "assignment_templates_name_trgm_idx" ON "assignment_templates" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "assignments_title_trgm_idx" ON "assignments" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "audit_log_entity_id_trgm_idx" ON "audit_log" USING gin ("entity_id" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "audit_log_details_trgm_idx" ON "audit_log" USING gin ((CAST("details" AS text)) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "email_queue_recipient_email_trgm_idx" ON "email_queue" USING gin ("recipient_email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "email_queue_subject_trgm_idx" ON "email_queue" USING gin ("subject" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "feedback_snippets_title_trgm_idx" ON "feedback_snippets" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "feedback_snippets_category_trgm_idx" ON "feedback_snippets" USING gin ("category" gin_trgm_ops);
