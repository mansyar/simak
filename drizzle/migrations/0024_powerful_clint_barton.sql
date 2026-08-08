CREATE TYPE "public"."appointment_status" AS ENUM('available', 'booked', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"checkpoint_id" integer,
	"instructor_id" text NOT NULL,
	"student_id" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_time_order_check" CHECK ("appointments"."start_at" < "appointments"."end_at"),
	CONSTRAINT "appointments_duration_range_check" CHECK ("appointments"."end_at" - "appointments"."start_at" >= INTERVAL '15 minutes' AND "appointments"."end_at" - "appointments"."start_at" <= INTERVAL '120 minutes')
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_assignment_status_start_at_idx" ON "appointments" USING btree ("assignment_id","status","start_at");--> statement-breakpoint
CREATE INDEX "appointments_instructor_status_start_at_idx" ON "appointments" USING btree ("instructor_id","status","start_at");--> statement-breakpoint
CREATE INDEX "appointments_student_status_start_at_idx" ON "appointments" USING btree ("student_id","status","start_at");--> statement-breakpoint
CREATE INDEX "appointments_checkpoint_id_idx" ON "appointments" USING btree ("checkpoint_id");