-- R6: email_queue template_type CHECK constraint — add 'two_factor' enum value
ALTER TABLE "email_queue" DROP CONSTRAINT IF EXISTS "email_queue_template_type_check";--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_template_type_check" CHECK ("template_type" IN ('password_reset', 'invitation', 'sla_alert', 'two_factor'));--> statement-breakpoint

-- R7: reviews.decision text → pgEnum (TDD line 384)
CREATE TYPE "review_decision" AS ENUM ('pass', 'revise');--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "decision" TYPE review_decision USING "decision"::review_decision;--> statement-breakpoint

-- R8: consultations.session_type text → pgEnum (TDD line 403)
CREATE TYPE "consultation_session_type" AS ENUM ('internal', 'external');--> statement-breakpoint
ALTER TABLE "consultations" ALTER COLUMN "session_type" TYPE consultation_session_type USING "session_type"::consultation_session_type;--> statement-breakpoint

-- R9: assignments CHECK constraints (TDD line 333-334)
-- maxExtensionDays: 1-30 (default 7). maxTotalExtensions: 1-10 (default 3).
-- NULL passes CHECK in PostgreSQL (NULL comparisons yield NULL, not false).
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_max_extension_days_range" CHECK ("max_extension_days" >= 1 AND "max_extension_days" <= 30);--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_max_total_extensions_range" CHECK ("max_total_extensions" >= 1 AND "max_total_extensions" <= 10);
