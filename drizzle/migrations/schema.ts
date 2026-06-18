import {
  pgTable,
  index,
  foreignKey,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  jsonb,
  unique,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const checkpointState = pgEnum('checkpoint_state', [
  'locked',
  'unlocked',
  'submitted',
  'under_review',
  'passed',
  'revise',
]);
export const consultationStatus = pgEnum('consultation_status', [
  'pending',
  'verified',
  'rejected',
]);
export const userRole = pgEnum('user_role', ['superadmin', 'admin', 'instructor', 'student']);

export const checkpoints = pgTable(
  'checkpoints',
  {
    id: serial().primaryKey().notNull(),
    assignmentId: integer('assignment_id').notNull(),
    name: text().notNull(),
    order: integer().notNull(),
    dueDate: timestamp('due_date', { mode: 'string' }),
    minConsultations: integer('min_consultations').default(0),
    state: checkpointState().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
    studentId: text('student_id').notNull(),
  },
  (table) => [
    index('checkpoints_assignment_id_idx').using(
      'btree',
      table.assignmentId.asc().nullsLast().op('int4_ops'),
    ),
    index('checkpoints_state_assignment_id_idx').using(
      'btree',
      table.state.asc().nullsLast().op('int4_ops'),
      table.assignmentId.asc().nullsLast().op('int4_ops'),
    ),
    index('checkpoints_student_id_idx').using(
      'btree',
      table.studentId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.assignmentId],
      foreignColumns: [assignments.id],
      name: 'checkpoints_assignment_id_assignments_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [users.id],
      name: 'checkpoints_student_id_users_id_fk',
    }),
  ],
);

export const assignmentTemplates = pgTable(
  'assignment_templates',
  {
    id: serial().primaryKey().notNull(),
    type: text().notNull(),
    name: text().notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'string' }),
  },
  (table) => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'assignment_templates_created_by_users_id_fk',
    }),
  ],
);

export const assignmentStudents = pgTable(
  'assignment_students',
  {
    id: serial().primaryKey().notNull(),
    assignmentId: integer('assignment_id').notNull(),
    studentId: text('student_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.assignmentId],
      foreignColumns: [assignments.id],
      name: 'assignment_students_assignment_id_assignments_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [users.id],
      name: 'assignment_students_student_id_users_id_fk',
    }),
  ],
);

export const submissions = pgTable(
  'submissions',
  {
    id: serial().primaryKey().notNull(),
    checkpointId: integer('checkpoint_id').notNull(),
    uploadedBy: text('uploaded_by').notNull(),
    fileKey: text('file_key').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    version: integer().default(1),
    uploadedAt: timestamp('uploaded_at', { mode: 'string' }).defaultNow(),
  },
  (table) => [
    index('submissions_checkpoint_id_idx').using(
      'btree',
      table.checkpointId.asc().nullsLast().op('int4_ops'),
    ),
    index('submissions_uploaded_by_idx').using(
      'btree',
      table.uploadedBy.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.checkpointId],
      foreignColumns: [checkpoints.id],
      name: 'submissions_checkpoint_id_checkpoints_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.uploadedBy],
      foreignColumns: [users.id],
      name: 'submissions_uploaded_by_users_id_fk',
    }),
  ],
);

export const reviews = pgTable(
  'reviews',
  {
    id: serial().primaryKey().notNull(),
    submissionId: integer('submission_id').notNull(),
    instructorId: text('instructor_id').notNull(),
    decision: text().notNull(),
    comment: text(),
    feedbackFileKey: text('feedback_file_key'),
    revisionDeadline: timestamp('revision_deadline', { mode: 'string' }),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    reviewedAt: timestamp('reviewed_at', { mode: 'string' }),
  },
  (table) => [
    index('reviews_submission_id_idx').using(
      'btree',
      table.submissionId.asc().nullsLast().op('int4_ops'),
    ),
    foreignKey({
      columns: [table.submissionId],
      foreignColumns: [submissions.id],
      name: 'reviews_submission_id_submissions_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.instructorId],
      foreignColumns: [users.id],
      name: 'reviews_instructor_id_users_id_fk',
    }),
  ],
);

export const consultations = pgTable(
  'consultations',
  {
    id: serial().primaryKey().notNull(),
    assignmentId: integer('assignment_id').notNull(),
    checkpointId: integer('checkpoint_id').notNull(),
    studentId: text('student_id').notNull(),
    verifiedById: text('verified_by_id'),
    status: consultationStatus().notNull(),
    notes: text(),
    externalConsultantName: text('external_consultant_name'),
    sessionType: text('session_type'),
    verifiedAt: timestamp('verified_at', { mode: 'string' }),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  },
  (table) => [
    index('consultations_checkpoint_id_idx').using(
      'btree',
      table.checkpointId.asc().nullsLast().op('int4_ops'),
    ),
    index('consultations_status_idx').using('btree', table.status.asc().nullsLast().op('enum_ops')),
    foreignKey({
      columns: [table.assignmentId],
      foreignColumns: [assignments.id],
      name: 'consultations_assignment_id_assignments_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.checkpointId],
      foreignColumns: [checkpoints.id],
      name: 'consultations_checkpoint_id_checkpoints_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [users.id],
      name: 'consultations_student_id_users_id_fk',
    }),
    foreignKey({
      columns: [table.verifiedById],
      foreignColumns: [users.id],
      name: 'consultations_verified_by_id_users_id_fk',
    }),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial().primaryKey().notNull(),
    userId: text('user_id').notNull(),
    type: text().notNull(),
    title: text().notNull(),
    message: text(),
    read: boolean().default(false),
    channel: text().notNull(),
    metadata: jsonb(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  },
  (table) => [
    index('notifications_user_id_read_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.read.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'notifications_user_id_users_id_fk',
    }).onDelete('cascade'),
  ],
);

export const assignments = pgTable(
  'assignments',
  {
    id: serial().primaryKey().notNull(),
    templateId: integer('template_id').notNull(),
    title: text().notNull(),
    description: text(),
    finalDeadline: timestamp('final_deadline', { mode: 'string' }).notNull(),
    instructorId: text('instructor_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'string' }),
    maxExtensionDays: integer('max_extension_days').default(7),
    maxTotalExtensions: integer('max_total_extensions').default(3),
  },
  (table) => [
    index('assignments_instructor_id_idx').using(
      'btree',
      table.instructorId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.templateId],
      foreignColumns: [assignmentTemplates.id],
      name: 'assignments_template_id_assignment_templates_id_fk',
    }),
    foreignKey({
      columns: [table.instructorId],
      foreignColumns: [users.id],
      name: 'assignments_instructor_id_users_id_fk',
    }),
  ],
);

export const templateCheckpoints = pgTable(
  'template_checkpoints',
  {
    id: serial().primaryKey().notNull(),
    templateId: integer('template_id').notNull(),
    name: text().notNull(),
    order: integer().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    minConsultations: integer('min_consultations').default(0),
    estimatedDuration: integer('estimated_duration').default(0),
  },
  (table) => [
    foreignKey({
      columns: [table.templateId],
      foreignColumns: [assignmentTemplates.id],
      name: 'template_checkpoints_template_id_assignment_templates_id_fk',
    }).onDelete('cascade'),
  ],
);

export const verification = pgTable('verification', {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    role: userRole().notNull(),
    locale: text().default('en'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'string' }),
    emailVerified: boolean('email_verified').default(false),
    image: text(),
  },
  (table) => [unique('users_email_unique').on(table.email)],
);

export const session = pgTable(
  'session',
  {
    id: text().primaryKey().notNull(),
    userId: text('user_id').notNull(),
    token: text().notNull(),
    expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'session_user_id_users_id_fk',
    }).onDelete('cascade'),
    unique('session_token_unique').on(table.token),
  ],
);

export const account = pgTable(
  'account',
  {
    id: text().primaryKey().notNull(),
    userId: text('user_id').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    password: text(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { mode: 'string' }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { mode: 'string' }),
    scope: text(),
    idToken: text('id_token'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'account_user_id_users_id_fk',
    }).onDelete('cascade'),
  ],
);

export const extensionRequests = pgTable(
  'extension_requests',
  {
    id: serial().primaryKey().notNull(),
    assignmentId: integer('assignment_id').notNull(),
    studentId: text('student_id').notNull(),
    checkpointId: integer('checkpoint_id'),
    requestedDeadline: timestamp('requested_deadline', { mode: 'string' }).notNull(),
    reason: text().notNull(),
    category: text().notNull(),
    extensionDays: integer('extension_days').notNull(),
    status: text().notNull(),
    resolvedBy: text('resolved_by'),
    resolutionReason: text('resolution_reason'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    resolvedAt: timestamp('resolved_at', { mode: 'string' }),
  },
  (table) => [
    index('extension_requests_assignment_id_status_idx').using(
      'btree',
      table.assignmentId.asc().nullsLast().op('int4_ops'),
      table.status.asc().nullsLast().op('int4_ops'),
    ),
    foreignKey({
      columns: [table.assignmentId],
      foreignColumns: [assignments.id],
      name: 'extension_requests_assignment_id_assignments_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [users.id],
      name: 'extension_requests_student_id_users_id_fk',
    }),
    foreignKey({
      columns: [table.checkpointId],
      foreignColumns: [checkpoints.id],
      name: 'extension_requests_checkpoint_id_checkpoints_id_fk',
    }),
    foreignKey({
      columns: [table.resolvedBy],
      foreignColumns: [users.id],
      name: 'extension_requests_resolved_by_users_id_fk',
    }),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial().primaryKey().notNull(),
    actorId: text('actor_id').notNull(),
    action: text().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    details: jsonb(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  },
  (table) => [
    index('audit_log_action_idx').using('btree', table.action.asc().nullsLast().op('text_ops')),
    index('audit_log_created_at_idx').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamp_ops'),
    ),
    index('audit_log_entity_type_entity_id_idx').using(
      'btree',
      table.entityType.asc().nullsLast().op('text_ops'),
      table.entityId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [users.id],
      name: 'audit_log_actor_id_users_id_fk',
    }),
  ],
);

export const emailQueue = pgTable(
  'email_queue',
  {
    id: serial().primaryKey().notNull(),
    recipientEmail: text('recipient_email').notNull(),
    subject: text().notNull(),
    bodyHtml: text('body_html').notNull(),
    templateType: text('template_type').notNull(),
    status: text().notNull(),
    attempts: integer().default(0),
    lastAttemptAt: timestamp('last_attempt_at', { mode: 'string' }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  },
  (table) => [
    index('email_queue_status_created_at_idx').using(
      'btree',
      table.status.asc().nullsLast().op('text_ops'),
      table.createdAt.asc().nullsLast().op('text_ops'),
    ),
  ],
);
