import { relations } from 'drizzle-orm';

// Re-export all schema tables and enums
export * from './users';
export * from './auth';
export * from './templates';
export * from './assignments';
export * from './academic-context';
export * from './submissions';
export * from './rubrics';
export * from './consultations';
export * from './appointments';
export * from './notifications';
export * from './audit-log';
export * from './extensions';
export * from './email-queue';
export * from './deadline-reminders';
export * from './gradebook';
export * from './discussions';
export * from './interventions';
export * from './feedback-snippets';
export * from './calendar-feed-tokens';
export * from './revision-action-items';

// Import tables for relations
import { users } from './users';
import { session, account, verification, twoFactor } from './auth';
import { assignmentTemplates, templateCheckpoints } from './templates';
import { assignments, assignmentStudents, checkpoints } from './assignments';
import { academicTerms, courses, courseSections, sectionEnrollments } from './academic-context';
import { submissions, reviews } from './submissions';
import { rubricCriteria, rubricLevels, reviewScores } from './rubrics';
import { consultations } from './consultations';
import { appointments } from './appointments';
import { notifications } from './notifications';
import { extensionRequests } from './extensions';
import { emailQueue } from './email-queue';
import { deadlineReminders } from './deadline-reminders';
import { assignmentGradeConfig, finalGrades, gradeReleaseSnapshots } from './gradebook';
import { checkpointDiscussions } from './discussions';
import { interventions } from './interventions';
import { feedbackSnippets } from './feedback-snippets';
import { calendarFeedTokens } from './calendar-feed-tokens';
import { revisionActionItems } from './revision-action-items';

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

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(users, {
    fields: [twoFactor.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  assignments: many(assignments),
  assignmentStudents: many(assignmentStudents),
  submissions: many(submissions),
  reviews: many(reviews),
  consultationsAsStudent: many(consultations),
  consultationsAsVerifier: many(consultations),
  appointmentsAsInstructor: many(appointments, { relationName: 'appointmentInstructor' }),
  appointmentsAsStudent: many(appointments, { relationName: 'appointmentStudent' }),
  twoFactor: many(twoFactor),
  finalGrades: many(finalGrades),
  gradeReleaseSnapshots: many(gradeReleaseSnapshots),
  interventions: many(interventions),
  feedbackSnippets: many(feedbackSnippets),
  calendarFeedTokens: many(calendarFeedTokens),
  sectionEnrollments: many(sectionEnrollments),
}));

export const academicTermsRelations = relations(academicTerms, ({ many }) => ({
  courseSections: many(courseSections),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  courseSections: many(courseSections),
}));

export const courseSectionsRelations = relations(courseSections, ({ one, many }) => ({
  academicTerm: one(academicTerms, {
    fields: [courseSections.termId],
    references: [academicTerms.id],
  }),
  course: one(courses, {
    fields: [courseSections.courseId],
    references: [courses.id],
  }),
  enrollments: many(sectionEnrollments),
  assignments: many(assignments),
}));

export const sectionEnrollmentsRelations = relations(sectionEnrollments, ({ one }) => ({
  section: one(courseSections, {
    fields: [sectionEnrollments.sectionId],
    references: [courseSections.id],
  }),
  user: one(users, {
    fields: [sectionEnrollments.userId],
    references: [users.id],
  }),
}));

export const calendarFeedTokensRelations = relations(calendarFeedTokens, ({ one }) => ({
  student: one(users, {
    fields: [calendarFeedTokens.studentId],
    references: [users.id],
  }),
}));

export const feedbackSnippetsRelations = relations(feedbackSnippets, ({ one }) => ({
  instructor: one(users, {
    fields: [feedbackSnippets.instructorId],
    references: [users.id],
  }),
}));

export const assignmentTemplatesRelations = relations(assignmentTemplates, ({ many, one }) => ({
  templateCheckpoints: many(templateCheckpoints),
  assignments: many(assignments),
  createdBy: one(users, {
    fields: [assignmentTemplates.createdBy],
    references: [users.id],
  }),
}));

export const templateCheckpointsRelations = relations(templateCheckpoints, ({ one, many }) => ({
  template: one(assignmentTemplates, {
    fields: [templateCheckpoints.templateId],
    references: [assignmentTemplates.id],
  }),
  rubricCriteria: many(rubricCriteria),
  rubricLevels: many(rubricLevels),
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
  section: one(courseSections, {
    fields: [assignments.sectionId],
    references: [courseSections.id],
  }),
  assignmentStudents: many(assignmentStudents),
  checkpoints: many(checkpoints),
  consultations: many(consultations),
  appointments: many(appointments),
  assignmentGradeConfig: one(assignmentGradeConfig),
  finalGrades: many(finalGrades),
  gradeReleaseSnapshots: many(gradeReleaseSnapshots),
  interventions: many(interventions),
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

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  submission: one(submissions, {
    fields: [reviews.submissionId],
    references: [submissions.id],
  }),
  instructor: one(users, {
    fields: [reviews.instructorId],
    references: [users.id],
  }),
  reviewScores: many(reviewScores),
  revisionActionItems: many(revisionActionItems),
}));

export const rubricCriteriaRelations = relations(rubricCriteria, ({ one, many }) => ({
  templateCheckpoint: one(templateCheckpoints, {
    fields: [rubricCriteria.templateCheckpointId],
    references: [templateCheckpoints.id],
  }),
  reviewScores: many(reviewScores),
  revisionActionItems: many(revisionActionItems),
}));

export const revisionActionItemsRelations = relations(revisionActionItems, ({ one }) => ({
  review: one(reviews, {
    fields: [revisionActionItems.reviewId],
    references: [reviews.id],
  }),
  criterion: one(rubricCriteria, {
    fields: [revisionActionItems.criterionId],
    references: [rubricCriteria.id],
  }),
}));

export const rubricLevelsRelations = relations(rubricLevels, ({ one, many }) => ({
  templateCheckpoint: one(templateCheckpoints, {
    fields: [rubricLevels.templateCheckpointId],
    references: [templateCheckpoints.id],
  }),
  reviewScores: many(reviewScores),
}));

export const reviewScoresRelations = relations(reviewScores, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewScores.reviewId],
    references: [reviews.id],
  }),
  criterion: one(rubricCriteria, {
    fields: [reviewScores.criterionId],
    references: [rubricCriteria.id],
  }),
  rubricLevel: one(rubricLevels, {
    fields: [reviewScores.rubricLevelId],
    references: [rubricLevels.id],
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

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  assignment: one(assignments, {
    fields: [appointments.assignmentId],
    references: [assignments.id],
  }),
  checkpoint: one(checkpoints, {
    fields: [appointments.checkpointId],
    references: [checkpoints.id],
  }),
  instructor: one(users, {
    relationName: 'appointmentInstructor',
    fields: [appointments.instructorId],
    references: [users.id],
  }),
  student: one(users, {
    relationName: 'appointmentStudent',
    fields: [appointments.studentId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const emailQueueRelations = relations(emailQueue, () => ({}));

export const deadlineRemindersRelations = relations(deadlineReminders, ({ one }) => ({
  checkpoint: one(checkpoints, {
    fields: [deadlineReminders.checkpointId],
    references: [checkpoints.id],
  }),
  student: one(users, {
    fields: [deadlineReminders.studentId],
    references: [users.id],
  }),
}));

export const extensionRequestsRelations = relations(extensionRequests, ({ one }) => ({
  assignment: one(assignments, {
    fields: [extensionRequests.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, {
    fields: [extensionRequests.studentId],
    references: [users.id],
  }),
  checkpoint: one(checkpoints, {
    fields: [extensionRequests.checkpointId],
    references: [checkpoints.id],
  }),
  resolver: one(users, {
    fields: [extensionRequests.resolvedBy],
    references: [users.id],
  }),
}));

export const assignmentGradeConfigRelations = relations(assignmentGradeConfig, ({ one }) => ({
  assignment: one(assignments, {
    fields: [assignmentGradeConfig.assignmentId],
    references: [assignments.id],
  }),
}));

export const finalGradesRelations = relations(finalGrades, ({ one }) => ({
  assignment: one(assignments, {
    fields: [finalGrades.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, {
    fields: [finalGrades.studentId],
    references: [users.id],
  }),
}));

export const gradeReleaseSnapshotsRelations = relations(gradeReleaseSnapshots, ({ one }) => ({
  assignment: one(assignments, {
    fields: [gradeReleaseSnapshots.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, {
    fields: [gradeReleaseSnapshots.studentId],
    references: [users.id],
  }),
}));

export const checkpointDiscussionsRelations = relations(checkpointDiscussions, ({ one, many }) => ({
  checkpoint: one(checkpoints, {
    fields: [checkpointDiscussions.checkpointId],
    references: [checkpoints.id],
  }),
  assignment: one(assignments, {
    fields: [checkpointDiscussions.assignmentId],
    references: [assignments.id],
  }),
  user: one(users, {
    fields: [checkpointDiscussions.userId],
    references: [users.id],
  }),
  parentMessage: one(checkpointDiscussions, {
    fields: [checkpointDiscussions.parentMessageId],
    references: [checkpointDiscussions.id],
    relationName: 'discussion_replies',
  }),
  replies: many(checkpointDiscussions),
}));

export const interventionsRelations = relations(interventions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [interventions.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, {
    fields: [interventions.studentId],
    references: [users.id],
  }),
}));
