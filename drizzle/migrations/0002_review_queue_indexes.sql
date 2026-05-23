--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_instructor_id_idx" ON "assignments" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkpoints_state_assignment_id_idx" ON "checkpoints" USING btree ("state","assignment_id");
