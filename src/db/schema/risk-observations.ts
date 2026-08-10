import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { academicTerms, courses, courseSections } from './academic-context';
import { assignments, checkpoints } from './assignments';
import { interventions } from './interventions';
import { users } from './users';

export const riskObservationSource = pgEnum('risk_observation_source', [
  'lifecycle_event',
  'daily_snapshot',
]);

export const riskLifecycleEventType = pgEnum('risk_lifecycle_event_type', [
  'checkpoint_updated',
  'submission_recorded',
  'review_recorded',
  'consultation_verified',
  'intervention_updated',
]);

export const riskObservationRetentionState = pgEnum('risk_observation_retention_state', [
  'identifiable',
  'anonymized',
]);

export const riskLevel = pgEnum('risk_level', ['low', 'medium', 'high']);

export type RiskObservationFactorSnapshot = {
  code: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
};

export const riskObservations = pgTable(
  'risk_observations',
  {
    id: serial('id').primaryKey(),
    source: riskObservationSource('source').notNull(),
    eventType: riskLifecycleEventType('event_type'),
    sourceEventId: text('source_event_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    assignmentId: integer('assignment_id').references(() => assignments.id),
    studentId: text('student_id').references(() => users.id),
    checkpointId: integer('checkpoint_id').references(() => checkpoints.id),
    interventionId: integer('intervention_id').references(() => interventions.id),
    academicTermId: integer('academic_term_id')
      .notNull()
      .references(() => academicTerms.id),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id),
    sectionId: integer('section_id')
      .notNull()
      .references(() => courseSections.id),
    observedAt: timestamp('observed_at').notNull(),
    algorithmVersion: text('algorithm_version').notNull(),
    riskLevel: riskLevel('risk_level').notNull(),
    factorSnapshot: jsonb('factor_snapshot').$type<RiskObservationFactorSnapshot[]>().notNull(),
    explanationSnapshot: jsonb('explanation_snapshot').$type<Record<string, unknown>>().notNull(),
    retentionState: riskObservationRetentionState('retention_state')
      .notNull()
      .default('identifiable'),
    anonymizedAt: timestamp('anonymized_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('risk_observations_idempotency_key_unique').on(table.idempotencyKey),
    index('risk_observations_student_assignment_observed_at_idx').on(
      table.studentId,
      table.assignmentId,
      table.observedAt,
    ),
    index('risk_observations_section_observed_at_idx').on(table.sectionId, table.observedAt),
    index('risk_observations_retention_idx').on(table.retentionState, table.academicTermId),
    check(
      'risk_observations_source_event_consistency',
      sql`(
        ${table.retentionState} = 'anonymized'
        AND ${table.eventType} IS NULL
        AND ${table.sourceEventId} IS NULL
      ) OR (
        ${table.source} = 'lifecycle_event'
        AND ${table.eventType} IS NOT NULL
        AND ${table.sourceEventId} IS NOT NULL
      ) OR (
        ${table.source} = 'daily_snapshot'
        AND ${table.eventType} IS NULL
        AND ${table.sourceEventId} IS NULL
      )`,
    ),
    check(
      'risk_observations_retention_anonymization_consistency',
      sql`(
        ${table.retentionState} = 'identifiable'
        AND ${table.studentId} IS NOT NULL
        AND ${table.assignmentId} IS NOT NULL
        AND ${table.anonymizedAt} IS NULL
      ) OR (
        ${table.retentionState} = 'anonymized'
        AND ${table.studentId} IS NULL
        AND ${table.assignmentId} IS NULL
        AND ${table.checkpointId} IS NULL
        AND ${table.interventionId} IS NULL
        AND ${table.sourceEventId} IS NULL
        AND ${table.anonymizedAt} IS NOT NULL
      )`,
    ),
  ],
);

export const riskObservationsRelations = relations(riskObservations, ({ one }) => ({
  assignment: one(assignments, {
    fields: [riskObservations.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, {
    fields: [riskObservations.studentId],
    references: [users.id],
  }),
  checkpoint: one(checkpoints, {
    fields: [riskObservations.checkpointId],
    references: [checkpoints.id],
  }),
  intervention: one(interventions, {
    fields: [riskObservations.interventionId],
    references: [interventions.id],
  }),
  academicTerm: one(academicTerms, {
    fields: [riskObservations.academicTermId],
    references: [academicTerms.id],
  }),
  course: one(courses, {
    fields: [riskObservations.courseId],
    references: [courses.id],
  }),
  section: one(courseSections, {
    fields: [riskObservations.sectionId],
    references: [courseSections.id],
  }),
}));
