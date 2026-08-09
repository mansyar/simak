import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const academicTermStatus = pgEnum('academic_term_status', [
  'draft',
  'active',
  'closed',
  'archived',
]);

export const courseSectionStatus = pgEnum('course_section_status', [
  'active',
  'inactive',
  'archived',
]);

export const sectionEnrollmentRole = pgEnum('section_enrollment_role', ['instructor', 'student']);

export const academicTerms = pgTable(
  'academic_terms',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: academicTermStatus('status').notNull().default('draft'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    archivedAt: timestamp('archived_at'),
  },
  (table) => [
    unique('academic_terms_code_unq').on(table.code),
    index('academic_terms_status_idx').on(table.status),
    check('academic_terms_date_range', sql`${table.startDate} <= ${table.endDate}`),
  ],
);

export const courses = pgTable(
  'courses',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    credits: numeric('credits', { precision: 5, scale: 2 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    archivedAt: timestamp('archived_at'),
  },
  (table) => [
    unique('courses_code_unq').on(table.code),
    check('courses_credits_positive', sql`${table.credits} IS NULL OR ${table.credits} > 0`),
  ],
);

export const courseSections = pgTable(
  'course_sections',
  {
    id: serial('id').primaryKey(),
    termId: integer('term_id')
      .notNull()
      .references(() => academicTerms.id),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id),
    code: text('code').notNull(),
    name: text('name'),
    status: courseSectionStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    archivedAt: timestamp('archived_at'),
  },
  (table) => [
    unique('course_sections_term_course_code_unq').on(table.termId, table.courseId, table.code),
    index('course_sections_term_course_idx').on(table.termId, table.courseId),
    index('course_sections_status_idx').on(table.status),
  ],
);

export const sectionEnrollments = pgTable(
  'section_enrollments',
  {
    id: serial('id').primaryKey(),
    sectionId: integer('section_id')
      .notNull()
      .references(() => courseSections.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: sectionEnrollmentRole('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    endedAt: timestamp('ended_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('section_enrollments_section_user_unq').on(table.sectionId, table.userId),
    index('section_enrollments_section_role_active_idx').on(
      table.sectionId,
      table.role,
      table.isActive,
    ),
    index('section_enrollments_user_role_active_idx').on(table.userId, table.role, table.isActive),
  ],
);
