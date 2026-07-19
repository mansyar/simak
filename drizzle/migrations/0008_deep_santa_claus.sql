DROP INDEX "reviews_submission_id_idx";--> statement-breakpoint
DROP INDEX "consultations_status_idx";--> statement-breakpoint
CREATE INDEX "users_role_deleted_at_idx" ON "users" USING btree ("role","deleted_at");--> statement-breakpoint
CREATE INDEX "template_checkpoints_template_id_order_idx" ON "template_checkpoints" USING btree ("template_id","order");--> statement-breakpoint
CREATE INDEX "assignment_students_assignment_id_student_id_idx" ON "assignment_students" USING btree ("assignment_id","student_id");--> statement-breakpoint
CREATE INDEX "assignment_students_student_id_idx" ON "assignment_students" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "reviews_submission_id_created_at_idx" ON "reviews" USING btree ("submission_id","created_at");--> statement-breakpoint
CREATE INDEX "consultations_assignment_id_status_idx" ON "consultations" USING btree ("assignment_id","status");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "extension_requests_assignment_id_student_id_idx" ON "extension_requests" USING btree ("assignment_id","student_id");