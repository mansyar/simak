/**
 * E2E Seed Script — Deterministic test data for Playwright E2E tests.
 *
 * Creates:
 *   - SuperAdmin (superadmin@e2e.test) — reads from SUPERADMIN_EMAIL/PASSWORD env vars
 *   - Admin (admin@e2e.test)
 *   - Instructor (instructor@e2e.test)
 *   - Student (student@e2e.test) — enrolled in E2E assignment
 *   - Student Two (student2@e2e.test) — enrolled in E2E assignment (multi-student scenarios)
 *   - Student Three (student3@e2e.test) — inactive in the isolated negative-fixture section
 *   All with password: TestPass123!
 *
 *   - Assignment template: "E2E Thesis Template" (3 checkpoints, type thesis, minConsultations: 1)
 *   - Assignment from template, assigned to student1 & student2 (first checkpoint unlocked, rest locked)
 *   - One pending consultation on Proposal checkpoint for student1 (instructor verification queue)
 *
 * Run via: npx tsx scripts/seed-e2e.ts
 * Requires DATABASE_URL env var pointing to the test database (port 5433).
 */
import { eq, and } from 'drizzle-orm';
import { getDb } from '../src/db/index';
import {
  users,
  account,
  assignmentTemplates,
  templateCheckpoints,
  assignments,
  assignmentStudents,
  checkpoints,
  consultations,
  feedbackSnippets,
  academicTerms,
  courses,
  courseSections,
  sectionEnrollments,
} from '../src/db/schema/index';
import { hashPassword } from 'better-auth/crypto';
import crypto from 'node:crypto';

const E2E_PASSWORD = 'TestPass123!';

const E2E_USERS = [
  { name: 'Admin', email: 'admin@e2e.test', role: 'admin' as const },
  { name: 'Instructor', email: 'instructor@e2e.test', role: 'instructor' as const },
  { name: 'Instructor Two', email: 'instructor2@e2e.test', role: 'instructor' as const },
  { name: 'Student', email: 'student@e2e.test', role: 'student' as const },
  { name: 'Student Two', email: 'student2@e2e.test', role: 'student' as const },
  { name: 'Student Three', email: 'student3@e2e.test', role: 'student' as const },
];

const E2E_TEMPLATE_CHECKPOINTS = [
  { name: 'Proposal', order: 1, minConsultations: 1, estimatedDuration: 14 },
  { name: 'Chapter 1', order: 2, minConsultations: 1, estimatedDuration: 14 },
  { name: 'Chapter 2', order: 3, minConsultations: 1, estimatedDuration: 14 },
];

/**
 * Seed the SuperAdmin user using SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD
 * environment variables. Not idempotent — assumes DB was truncated first.
 */
async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD environment variables are required.');
  }

  const db = getDb();
  const userId = crypto.randomUUID();

  await db.insert(users).values({
    id: userId,
    name: 'SuperAdmin',
    email,
    role: 'superadmin',
    emailVerified: true,
    locale: 'en',
  });

  const hashedPassword = await hashPassword(password);
  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId,
    accountId: userId,
    providerId: 'credential',
    password: hashedPassword,
  });

  console.log(`[E2E Seed] SuperAdmin created: ${email}`);
}

/**
 * Seed Admin, Instructor, and Student users with a fixed password.
 * Not idempotent — assumes DB was truncated first.
 */
async function seedE2EUsers(): Promise<void> {
  const db = getDb();
  const hashedPassword = await hashPassword(E2E_PASSWORD);

  for (const u of E2E_USERS) {
    const userId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      name: u.name,
      email: u.email,
      role: u.role,
      emailVerified: true,
      locale: 'en',
    });

    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId,
      accountId: userId,
      providerId: 'credential',
      password: hashedPassword,
    });

    console.log(`[E2E Seed] ${u.role} created: ${u.email}`);
  }
}

/**
 * Seed assignment template with 3 checkpoints, then create an assignment
 * from it assigned to the E2E student.
 */
async function seedTemplateAndAssignment(): Promise<void> {
  const db = getDb();

  // Find the E2E instructor and students
  const [instructorUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'instructor@e2e.test'));
  const [instructorTwoUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'instructor2@e2e.test'));

  const [studentUser] = await db.select().from(users).where(eq(users.email, 'student@e2e.test'));
  const [student2User] = await db.select().from(users).where(eq(users.email, 'student2@e2e.test'));
  const [student3User] = await db.select().from(users).where(eq(users.email, 'student3@e2e.test'));

  if (!instructorUser || !studentUser) {
    throw new Error('E2E instructor or student not found. Run seedE2EUsers() first.');
  }

  const [term] = await db
    .insert(academicTerms)
    .values({
      code: 'E2E-2026-1',
      name: 'E2E Academic Term',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      status: 'active',
    })
    .returning({ id: academicTerms.id });
  const [course] = await db
    .insert(courses)
    .values({ code: 'E2E-THESIS', name: 'E2E Thesis Course', credits: '3.00' })
    .returning({ id: courses.id });
  const [section] = await db
    .insert(courseSections)
    .values({
      termId: term.id,
      courseId: course.id,
      code: 'A',
      name: 'E2E Thesis Section',
    })
    .returning({ id: courseSections.id });

  await db
    .insert(sectionEnrollments)
    .values([
      { sectionId: section.id, userId: instructorUser.id, role: 'instructor' },
      { sectionId: section.id, userId: studentUser.id, role: 'student' },
      ...(student2User
        ? [{ sectionId: section.id, userId: student2User.id, role: 'student' as const }]
        : []),
    ]);

  const [negativeSection] = await db
    .insert(courseSections)
    .values({
      termId: term.id,
      courseId: course.id,
      code: 'B',
      name: 'E2E Negative Fixture Section',
    })
    .returning({ id: courseSections.id });

  if (instructorTwoUser) {
    await db.insert(sectionEnrollments).values({
      sectionId: negativeSection.id,
      userId: instructorTwoUser.id,
      role: 'instructor',
    });
  }

  if (student3User) {
    await db.insert(sectionEnrollments).values({
      sectionId: negativeSection.id,
      userId: student3User.id,
      role: 'student',
      isActive: false,
    });
  }

  console.log('[E2E Seed] Academic term, course, section, and enrollments created.');
  console.log('[E2E Seed] Cross-section and inactive-enrollment fixtures created.');

  await db.insert(feedbackSnippets).values([
    {
      instructorId: instructorUser.id,
      title: 'E2E Evidence Reminder',
      category: 'Evidence',
      body: 'Support each claim with specific evidence.',
    },
    {
      instructorId: instructorUser.id,
      title: 'E2E Archived Snippet',
      category: 'Archived',
      body: 'This archived snippet must stay private and unavailable for insertion.',
      archivedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    ...(instructorTwoUser
      ? [
          {
            instructorId: instructorTwoUser.id,
            title: 'Instructor Two Private Snippet',
            category: 'Private',
            body: 'This snippet belongs only to instructor two.',
          },
        ]
      : []),
  ]);

  console.log('[E2E Seed] Feedback snippet fixtures created.');

  // --- Create template with checkpoints ---
  const [template] = await db
    .insert(assignmentTemplates)
    .values({
      type: 'thesis',
      name: 'E2E Thesis Template',
      createdBy: instructorUser.id,
    })
    .returning();

  for (const cp of E2E_TEMPLATE_CHECKPOINTS) {
    await db.insert(templateCheckpoints).values({
      templateId: template.id,
      name: cp.name,
      order: cp.order,
      minConsultations: cp.minConsultations,
      estimatedDuration: cp.estimatedDuration,
    });
  }

  console.log(
    `[E2E Seed] Template created: "${template.name}" with ${E2E_TEMPLATE_CHECKPOINTS.length} checkpoints.`,
  );

  // --- Create assignment from template ---
  const finalDeadline = new Date();
  finalDeadline.setDate(finalDeadline.getDate() + 90); // 90 days from now

  const [assignment] = await db
    .insert(assignments)
    .values({
      templateId: template.id,
      title: 'E2E Test Assignment',
      description: 'Assignment for E2E testing — file submission and review flows.',
      finalDeadline,
      instructorId: instructorUser.id,
      sectionId: section.id,
      mode: 'individual',
      status: 'active',
    })
    .returning();

  console.log(`[E2E Seed] Assignment created: "${assignment.title}".`);

  // --- Enroll student ---
  await db.insert(assignmentStudents).values({
    assignmentId: assignment.id,
    studentId: studentUser.id,
  });

  console.log(`[E2E Seed] Student enrolled: ${studentUser.email}.`);

  // --- Create per-student checkpoints ---
  for (const cp of E2E_TEMPLATE_CHECKPOINTS) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + cp.estimatedDuration);
    // First checkpoint unlocked so student can upload immediately
    const state = cp.order === 1 ? 'unlocked' : 'locked';

    await db.insert(checkpoints).values({
      assignmentId: assignment.id,
      studentId: studentUser.id,
      name: cp.name,
      order: cp.order,
      dueDate,
      minConsultations: cp.minConsultations,
      state,
    });
  }

  console.log(`[E2E Seed] Created ${E2E_TEMPLATE_CHECKPOINTS.length} per-student checkpoints.`);

  // --- Enroll student2 and create their checkpoints ---
  if (student2User) {
    await db.insert(assignmentStudents).values({
      assignmentId: assignment.id,
      studentId: student2User.id,
    });

    console.log(`[E2E Seed] Student2 enrolled: ${student2User.email}.`);

    for (const cp of E2E_TEMPLATE_CHECKPOINTS) {
      const dueDate = new Date();
      if (cp.order === 1) {
        dueDate.setDate(dueDate.getDate() - 1);
      } else {
        dueDate.setDate(dueDate.getDate() + cp.estimatedDuration);
      }
      const state = cp.order === 1 ? 'unlocked' : 'locked';

      await db.insert(checkpoints).values({
        assignmentId: assignment.id,
        studentId: student2User.id,
        name: cp.name,
        order: cp.order,
        dueDate,
        minConsultations: cp.minConsultations,
        state,
      });
    }

    console.log(`[E2E Seed] Created checkpoints for student2.`);
  }

  // --- Create one pending consultation on Proposal checkpoint for student1 ---
  const [proposalCheckpoint] = await db
    .select()
    .from(checkpoints)
    .where(and(eq(checkpoints.name, 'Proposal'), eq(checkpoints.studentId, studentUser.id)));

  if (proposalCheckpoint) {
    await db.insert(consultations).values({
      assignmentId: assignment.id,
      checkpointId: proposalCheckpoint.id,
      studentId: studentUser.id,
      status: 'pending',
      sessionType: 'internal',
      notes: 'E2E seed consultation for verification queue.',
    });

    console.log(`[E2E Seed] Created pending consultation on Proposal checkpoint.`);
  }
}

// --- Entry point ---
// Cross-platform: compare resolved paths (handles Windows backslashes)
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('seed-e2e.ts') ||
    process.argv[1].endsWith('seed-e2e.mjs') ||
    import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`);

if (isDirectExecution) {
  seedSuperAdmin()
    .then(() => seedE2EUsers())
    .then(() => seedTemplateAndAssignment())
    .then(() => {
      console.log('[E2E Seed] All seed data created successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[E2E Seed] Seed failed:', err);
      process.exit(1);
    });
}
