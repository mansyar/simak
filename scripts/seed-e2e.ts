/**
 * E2E Seed Script — Deterministic test data for Playwright E2E tests.
 *
 * Creates:
 *   - SuperAdmin (superadmin@e2e.test) — reads from SUPERADMIN_EMAIL/PASSWORD env vars
 *   - Admin (admin@e2e.test)
 *   - Instructor (instructor@e2e.test)
 *   - Student (student@e2e.test)
 *   All with password: TestPass123!
 *
 *   - Assignment template: "E2E Thesis Template" (3 checkpoints, type thesis, minConsultations: 1)
 *   - Assignment from template, assigned to student (first checkpoint unlocked, rest locked)
 *
 * Run via: npx tsx scripts/seed-e2e.ts
 * Requires DATABASE_URL env var pointing to the test database (port 5433).
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/index';
import {
  users,
  account,
  assignmentTemplates,
  templateCheckpoints,
  assignments,
  assignmentStudents,
  checkpoints,
} from '../src/db/schema/index';
import { hashPassword } from 'better-auth/crypto';
import crypto from 'node:crypto';

const E2E_PASSWORD = 'TestPass123!';

const E2E_USERS = [
  { name: 'Admin', email: 'admin@e2e.test', role: 'admin' as const },
  { name: 'Instructor', email: 'instructor@e2e.test', role: 'instructor' as const },
  { name: 'Student', email: 'student@e2e.test', role: 'student' as const },
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

  // Find the E2E instructor and student
  const [instructorUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'instructor@e2e.test'));

  const [studentUser] = await db.select().from(users).where(eq(users.email, 'student@e2e.test'));

  if (!instructorUser || !studentUser) {
    throw new Error('E2E instructor or student not found. Run seedE2EUsers() first.');
  }

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
