import { relations } from 'drizzle-orm';

// Re-export all schema tables and enums
export * from './users';
export * from './auth';
export * from './templates';
export * from './assignments';
export * from './submissions';
export * from './consultations';
export * from './notifications';

// Import tables for relations
import { users } from './users';
import { session, account, verification } from './auth';
import { assignmentTemplates, templateCheckpoints } from './templates';
import { assignments, assignmentStudents, checkpoints } from './assignments';
import { submissions, reviews } from './submissions';
import { consultations } from './consultations';
import { notifications } from './notifications';

// ---- Relations ----

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(users, {
    fields: [session.userId],
    references: [users.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(users, {
    fields: [account.userId],
    references: [users.id],
  }),
}));

export const verificationRelations = relations(verification, () => ({}));

export const usersRelations = relations(users, ({ many }) => ({
  assignments: many(assignments),
  assignmentStudents: many(assignmentStudents),
  submissions: many(submissions),
  reviews: many(reviews),
  consultationsAsStudent: many(consultations),
  consultationsAsVerifier: many(consultations),
}));

export const assignmentTemplatesRelations = relations(assignmentTemplates, ({ many, one }) => ({
  templateCheckpoints: many(templateCheckpoints),
  assignments: many(assignments),
  createdBy: one(users, {
    fields: [assignmentTemplates.createdBy],
    references: [users.id],
  }),
}));

export const templateCheckpointsRelations = relations(templateCheckpoints, ({ one }) => ({
  template: one(assignmentTemplates, {
    fields: [templateCheckpoints.templateId],
    references: [assignmentTemplates.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ many, one }) => ({
  template: one(assignmentTemplates, {
    fields: [assignments.templateId],
    references: [assignmentTemplates.id],
  }),
  instructor: one(users, {
    fields: [assignments.instructorId],
    references: [users.id],
  }),
  assignmentStudents: many(assignmentStudents),
  checkpoints: many(checkpoints),
  consultations: many(consultations),
}));

export const assignmentStudentsRelations = relations(assignmentStudents, ({ one }) => ({
  assignment: one(assignments, {
    fields: [assignmentStudents.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, {
    fields: [assignmentStudents.studentId],
    references: [users.id],
  }),
}));

export const checkpointsRelations = relations(checkpoints, ({ many, one }) => ({
  assignment: one(assignments, {
    fields: [checkpoints.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, {
    fields: [checkpoints.studentId],
    references: [users.id],
  }),
  submissions: many(submissions),
}));

export const submissionsRelations = relations(submissions, ({ many, one }) => ({
  checkpoint: one(checkpoints, {
    fields: [submissions.checkpointId],
    references: [checkpoints.id],
  }),
  uploadedByUser: one(users, {
    fields: [submissions.uploadedBy],
    references: [users.id],
  }),
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  submission: one(submissions, {
    fields: [reviews.submissionId],
    references: [submissions.id],
  }),
  instructor: one(users, {
    fields: [reviews.instructorId],
    references: [users.id],
  }),
}));

export const consultationsRelations = relations(consultations, ({ one }) => ({
  assignment: one(assignments, {
    fields: [consultations.assignmentId],
    references: [assignments.id],
  }),
  checkpoint: one(checkpoints, {
    fields: [consultations.checkpointId],
    references: [checkpoints.id],
  }),
  student: one(users, {
    fields: [consultations.studentId],
    references: [users.id],
  }),
  verifiedBy: one(users, {
    fields: [consultations.verifiedById],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
