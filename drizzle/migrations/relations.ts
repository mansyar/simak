import { relations } from 'drizzle-orm/relations';
import {
  assignments,
  checkpoints,
  users,
  assignmentTemplates,
  assignmentStudents,
  submissions,
  reviews,
  consultations,
  notifications,
  templateCheckpoints,
  session,
  account,
  extensionRequests,
  auditLog,
} from './schema';

export const checkpointsRelations = relations(checkpoints, ({ one, many }) => ({
  assignment: one(assignments, {
    fields: [checkpoints.assignmentId],
    references: [assignments.id],
  }),
  user: one(users, {
    fields: [checkpoints.studentId],
    references: [users.id],
  }),
  submissions: many(submissions),
  consultations: many(consultations),
  extensionRequests: many(extensionRequests),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  checkpoints: many(checkpoints),
  assignmentStudents: many(assignmentStudents),
  consultations: many(consultations),
  assignmentTemplate: one(assignmentTemplates, {
    fields: [assignments.templateId],
    references: [assignmentTemplates.id],
  }),
  user: one(users, {
    fields: [assignments.instructorId],
    references: [users.id],
  }),
  extensionRequests: many(extensionRequests),
}));

export const usersRelations = relations(users, ({ many }) => ({
  checkpoints: many(checkpoints),
  assignmentTemplates: many(assignmentTemplates),
  assignmentStudents: many(assignmentStudents),
  submissions: many(submissions),
  reviews: many(reviews),
  consultations_studentId: many(consultations, {
    relationName: 'consultations_studentId_users_id',
  }),
  consultations_verifiedById: many(consultations, {
    relationName: 'consultations_verifiedById_users_id',
  }),
  notifications: many(notifications),
  assignments: many(assignments),
  sessions: many(session),
  accounts: many(account),
  extensionRequests_studentId: many(extensionRequests, {
    relationName: 'extensionRequests_studentId_users_id',
  }),
  extensionRequests_resolvedBy: many(extensionRequests, {
    relationName: 'extensionRequests_resolvedBy_users_id',
  }),
  auditLogs: many(auditLog),
}));

export const assignmentTemplatesRelations = relations(assignmentTemplates, ({ one, many }) => ({
  user: one(users, {
    fields: [assignmentTemplates.createdBy],
    references: [users.id],
  }),
  assignments: many(assignments),
  templateCheckpoints: many(templateCheckpoints),
}));

export const assignmentStudentsRelations = relations(assignmentStudents, ({ one }) => ({
  assignment: one(assignments, {
    fields: [assignmentStudents.assignmentId],
    references: [assignments.id],
  }),
  user: one(users, {
    fields: [assignmentStudents.studentId],
    references: [users.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  checkpoint: one(checkpoints, {
    fields: [submissions.checkpointId],
    references: [checkpoints.id],
  }),
  user: one(users, {
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
  user: one(users, {
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
  user_studentId: one(users, {
    fields: [consultations.studentId],
    references: [users.id],
    relationName: 'consultations_studentId_users_id',
  }),
  user_verifiedById: one(users, {
    fields: [consultations.verifiedById],
    references: [users.id],
    relationName: 'consultations_verifiedById_users_id',
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const templateCheckpointsRelations = relations(templateCheckpoints, ({ one }) => ({
  assignmentTemplate: one(assignmentTemplates, {
    fields: [templateCheckpoints.templateId],
    references: [assignmentTemplates.id],
  }),
}));

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

export const extensionRequestsRelations = relations(extensionRequests, ({ one }) => ({
  assignment: one(assignments, {
    fields: [extensionRequests.assignmentId],
    references: [assignments.id],
  }),
  user_studentId: one(users, {
    fields: [extensionRequests.studentId],
    references: [users.id],
    relationName: 'extensionRequests_studentId_users_id',
  }),
  checkpoint: one(checkpoints, {
    fields: [extensionRequests.checkpointId],
    references: [checkpoints.id],
  }),
  user_resolvedBy: one(users, {
    fields: [extensionRequests.resolvedBy],
    references: [users.id],
    relationName: 'extensionRequests_resolvedBy_users_id',
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.actorId],
    references: [users.id],
  }),
}));
