import { eq } from 'drizzle-orm';
import { getDb } from './index';
import {
  users,
  account,
  assignmentTemplates,
  templateCheckpoints,
  assignments,
  assignmentStudents,
  checkpoints,
} from './schema/index';
import { hashPassword } from 'better-auth/crypto';
import crypto from 'node:crypto';

/**
 * Validate seed environment variables.
 * Throws with a descriptive message if validation fails.
 */
function validateEnv(): { email: string; password: string } {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD environment variables are required.');
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }

  if (password.length < 8) {
    throw new Error('SUPERADMIN_PASSWORD must be at least 8 characters long.');
  }

  return { email, password };
}

/**
 * Seed a SuperAdmin user using SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD
 * environment variables. Idempotent — safe to run multiple times.
 */
export async function seedSuperAdmin(): Promise<void> {
  const { email, password } = validateEnv();
  const db = getDb();

  // Idempotency: skip if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email));

  if (existing.length > 0) {
    console.log(`SuperAdmin user already exists (${email}). Skipping.`);
    return;
  }

  const userId = crypto.randomUUID();

  // Create the user record
  await db.insert(users).values({
    id: userId,
    name: 'SuperAdmin',
    email,
    role: 'superadmin',
    locale: 'en',
  });

  // Create the account record with hashed password (Better-Auth credential provider)
  const hashedPassword = await hashPassword(password);
  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId,
    accountId: userId,
    providerId: 'credential',
    password: hashedPassword,
  });

  console.log(`SuperAdmin user created (${email}).`);
}

export async function seedTestUsers(): Promise<void> {
  const db = getDb();
  const testPassword = process.env.TEST_USER_PASSWORD || 'password';
  const hashedPassword = await hashPassword(testPassword);

  const testUsers = [
    { name: 'Instructor', email: 'instructor@simak.app', role: 'instructor' as const },
    { name: 'Student', email: 'student@simak.app', role: 'student' as const },
  ];

  for (const u of testUsers) {
    const existing = await db.select().from(users).where(eq(users.email, u.email));
    if (existing.length > 0) {
      console.log(`Test user already exists (${u.email}). Skipping.`);
      continue;
    }

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

    console.log(`Test user created: ${u.name} (${u.email}) / ${testPassword}`);
  }
}

/**
 * Seed test templates and assignments.
 * Idempotent — checks if "Test Template" already exists before creating.
 * Relies on test users (instructor + student) being seeded first.
 */
export async function seedTestTemplatesAndAssignments(): Promise<void> {
  const db = getDb();

  // Find test users
  const [instructorUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'instructor@simak.app'));

  const [studentUser] = await db.select().from(users).where(eq(users.email, 'student@simak.app'));

  if (!instructorUser || !studentUser) {
    console.log('Test users not found. Run seedTestUsers() first. Skipping.');
    return;
  }

  // Idempotency: skip if template already exists
  const existingTemplate = await db
    .select()
    .from(assignmentTemplates)
    .where(eq(assignmentTemplates.name, 'Test Template'));

  if (existingTemplate.length > 0) {
    console.log('Test template already exists. Skipping.');
    return;
  }

  // --- Create template with checkpoints ---
  const [template] = await db
    .insert(assignmentTemplates)
    .values({
      type: 'thesis',
      name: 'Test Template',
      createdBy: instructorUser.id,
    })
    .returning();

  const templateCheckpointData = [
    { name: 'Proposal', order: 1, minConsultations: 1, estimatedDuration: 14 },
    { name: 'Chapter 1', order: 2, minConsultations: 1, estimatedDuration: 14 },
    { name: 'Chapter 2', order: 3, minConsultations: 2, estimatedDuration: 21 },
    { name: 'Chapter 3', order: 4, minConsultations: 2, estimatedDuration: 21 },
    { name: 'Final Defense', order: 5, minConsultations: 1, estimatedDuration: 7 },
  ];

  for (const cp of templateCheckpointData) {
    await db.insert(templateCheckpoints).values({
      templateId: template.id,
      name: cp.name,
      order: cp.order,
      minConsultations: cp.minConsultations,
      estimatedDuration: cp.estimatedDuration,
    });
  }

  console.log(
    `Test template created: "${template.name}" with ${templateCheckpointData.length} checkpoints.`,
  );

  // --- Create assignment from template ---
  const finalDeadline = new Date();
  finalDeadline.setDate(finalDeadline.getDate() + 90); // 90 days from now

  const [assignment] = await db
    .insert(assignments)
    .values({
      templateId: template.id,
      title: 'Test Assignment',
      description: 'A test assignment for development and testing purposes.',
      finalDeadline,
      instructorId: instructorUser.id,
    })
    .returning();

  console.log(`Test assignment created: "${assignment.title}".`);

  // --- Enroll student ---
  await db.insert(assignmentStudents).values({
    assignmentId: assignment.id,
    studentId: studentUser.id,
  });

  console.log(`Student enrolled: ${studentUser.email}.`);

  // --- Create per-student checkpoints ---
  for (const cp of templateCheckpointData) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + cp.estimatedDuration);
    // First checkpoint unlocked so student can upload immediately for testing
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

  console.log(`Created ${templateCheckpointData.length} per-student checkpoints.`);
}

/**
 * Run the production-safe bootstrap. Test fixtures remain available to the
 * dedicated test seed helpers, but are never created by the production entry point.
 */
export async function runProductionSeed(): Promise<void> {
  await seedSuperAdmin();
}

// Allow running directly: `tsx src/db/seed.ts` or `node .output/server/seed.mjs`
// Cross-platform: compare resolved paths (handles Windows backslashes)
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('seed.ts') ||
    process.argv[1].endsWith('seed.mjs') ||
    import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`);
if (isDirectExecution) {
  runProductionSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
