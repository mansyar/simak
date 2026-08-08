import { expect, test, type Browser, type Page } from '@playwright/test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { loginAsRole } from './helpers/auth';

const ASSIGNMENT_TITLE = 'E2E Test Assignment';
const INSTRUCTOR_EMAIL = 'instructor@e2e.test';
const STUDENT_EMAIL = 'student@e2e.test';

type E2EContext = {
  assignmentId: number;
  checkpointId: number;
  checkpointName: string;
  studentId: string;
};

async function getE2EContext(): Promise<E2EContext> {
  const sql = postgres(getDatabaseUrl());
  const [assignment] = await sql<{ id: number }[]>`
    SELECT id FROM assignments WHERE title = ${ASSIGNMENT_TITLE} LIMIT 1
  `;
  if (!assignment) throw new Error(`Assignment "${ASSIGNMENT_TITLE}" not found`);

  const [checkpoint] = await sql<{ id: number; name: string }[]>`
    SELECT id, name FROM checkpoints
    WHERE assignment_id = ${assignment.id}
    ORDER BY "order"
    LIMIT 1
  `;
  const [student] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${STUDENT_EMAIL} LIMIT 1
  `;
  await sql.end();

  if (!checkpoint || !student) throw new Error('E2E appointment fixture is incomplete');
  return {
    assignmentId: assignment.id,
    checkpointId: checkpoint.id,
    checkpointName: checkpoint.name,
    studentId: student.id,
  };
}

async function createCalendarToken(studentId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const sql = postgres(getDatabaseUrl());
  await sql`
    INSERT INTO calendar_feed_tokens (id, student_id, token_hash)
    VALUES (${randomUUID()}, ${studentId}, ${tokenHash})
  `;
  await sql.end();
  return token;
}

async function waitForAppointment(
  assignmentId: number,
  status: string,
  expectedCount = 1,
): Promise<number[]> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const sql = postgres(getDatabaseUrl());
    const rows = await sql<{ id: number }[]>`
      SELECT id FROM appointments
      WHERE assignment_id = ${assignmentId} AND status = ${status}
      ORDER BY id
    `;
    await sql.end();
    if (rows.length >= expectedCount) return rows.map((row) => row.id);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${expectedCount} ${status} appointment(s)`);
}

async function waitForAppointmentStatus(appointmentId: number, status: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const sql = postgres(getDatabaseUrl());
    const [row] = await sql<{ status: string }[]>`
      SELECT status FROM appointments WHERE id = ${appointmentId}
    `;
    await sql.end();
    if (row?.status === status) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for appointment ${appointmentId} to become ${status}`);
}

async function waitForNotification(
  appointmentId: number,
  type: string,
  recipientEmail?: string,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const sql = postgres(getDatabaseUrl());
    const rows = await sql<{ id: number }[]>`
      SELECT n.id
      FROM notifications n
      JOIN users u ON u.id = n.user_id
      WHERE n.type = ${type}
        AND n.metadata->>'appointmentId' = ${String(appointmentId)}
        ${recipientEmail ? sql`AND u.email = ${recipientEmail}` : sql``}
      LIMIT 1
    `;
    await sql.end();
    if (rows.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${type} notification`);
}

async function waitForConsultationStatus(checkpointId: number, status: string): Promise<number> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const sql = postgres(getDatabaseUrl());
    const [row] = await sql<{ id: number }[]>`
      SELECT id FROM consultations
      WHERE checkpoint_id = ${checkpointId} AND status = ${status}
      ORDER BY id DESC
      LIMIT 1
    `;
    await sql.end();
    if (row) return row.id;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${status} consultation`);
}

async function setAppointmentEnded(appointmentId: number): Promise<void> {
  const sql = postgres(getDatabaseUrl());
  await sql`
    UPDATE appointments
    SET start_at = NOW() - INTERVAL '2 hours',
        end_at = NOW() - INTERVAL '1 hour',
        updated_at = NOW()
    WHERE id = ${appointmentId}
  `;
  await sql.end();
}

async function getAppointmentTimes(
  appointmentId: number,
): Promise<{ startAt: Date | string; endAt: Date | string }> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql<{ startAt: Date | string; endAt: Date | string }[]>`
    SELECT start_at AS "startAt", end_at AS "endAt"
    FROM appointments WHERE id = ${appointmentId}
  `;
  await sql.end();
  if (!row) throw new Error(`Appointment ${appointmentId} not found`);
  return row;
}

function futureLocalInput(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function nextNewYorkFallbackInput(): { start: string; end: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  const fallback = new Date(Date.UTC(year, 10, 1));
  if (fallback.getTime() <= now.getTime()) year += 1;
  const first = new Date(Date.UTC(year, 10, 1));
  while (first.getUTCDay() !== 0) first.setUTCDate(first.getUTCDate() + 1);
  const date = first.toISOString().slice(0, 10);
  return { start: `${date}T00:30`, end: `${date}T01:00` };
}

async function navigateToAssignment(
  page: Page,
  role: 'student' | 'instructor',
  assignmentId: number,
) {
  await page.goto(`/${role}/assignments/${assignmentId}`);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  const consultationsTab = page.getByRole('tab', { name: /Consultations/i });
  await expect(consultationsTab).toBeVisible();
  await consultationsTab.click();
  await expect(
    page.getByRole('heading', {
      name: role === 'student' ? /^Appointments$/i : /Consultation scheduling/i,
    }),
  ).toBeVisible();
}

async function publishSlot(
  page: Page,
  start: string,
  end: string,
  checkpointName: string,
): Promise<void> {
  await page.locator('#appointment-start').fill(start);
  await page.locator('#appointment-end').fill(end);
  await page.locator('#appointment-checkpoint').selectOption({ label: checkpointName });
  await page.getByRole('button', { name: /Publish/i }).click();
}

function appointmentEvent(body: string, appointmentId: number): string {
  const uid = `appointment-${appointmentId}@simak`;
  const event = body.split('BEGIN:VEVENT').find((chunk) => chunk.includes(uid));
  if (!event) throw new Error(`Calendar event ${uid} not found`);
  return event;
}

function toUtcCalendarValue(value: Date | string): string {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace('.000Z', 'Z');
}

test.describe('Appointment scheduling lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  let fixture: E2EContext;
  let calendarToken: string;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    await resetDatabase();
    fixture = await getE2EContext();
    const sql = postgres(getDatabaseUrl());
    await sql`DELETE FROM consultations`;
    await sql.end();
    calendarToken = await createCalendarToken(fixture.studentId);
  });

  test('runs publish, booking, rescheduling, cancellation, and private calendar refresh', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const instructorContext = await browser.newContext({
      colorScheme: 'light',
      timezoneId: 'America/New_York',
    });
    const studentContext = await browser.newContext({
      colorScheme: 'dark',
      timezoneId: 'America/New_York',
      viewport: { width: 320, height: 800 },
    });
    const instructorPage = await instructorContext.newPage();
    const studentPage = await studentContext.newPage();

    try {
      await loginAsRole(instructorPage, 'instructor');
      await loginAsRole(studentPage, 'student');

      const dstSlot = nextNewYorkFallbackInput();
      await navigateToAssignment(instructorPage, 'instructor', fixture.assignmentId);
      await publishSlot(instructorPage, dstSlot.start, dstSlot.end, fixture.checkpointName);
      const [firstAppointmentId] = await waitForAppointment(fixture.assignmentId, 'available');
      await expect(instructorPage.getByText(/America\/New_York/).first()).toBeVisible();

      await navigateToAssignment(studentPage, 'student', fixture.assignmentId);
      await expect(studentPage.getByRole('button', { name: /Book/i }).first()).toBeVisible();
      await studentPage.getByRole('button', { name: /Book/i }).first().click();
      await waitForAppointmentStatus(firstAppointmentId, 'booked');
      await waitForNotification(firstAppointmentId, 'appointment_booked', STUDENT_EMAIL);
      await waitForNotification(firstAppointmentId, 'appointment_booked', INSTRUCTOR_EMAIL);

      const firstFeed = await studentPage.request.get(
        `/api/calendar/ics?token=${encodeURIComponent(calendarToken)}`,
      );
      expect(firstFeed.status()).toBe(200);
      const firstBody = await firstFeed.text();
      expect(firstBody).not.toContain(calendarToken);
      const firstEvent = appointmentEvent(firstBody, firstAppointmentId);
      expect(firstEvent).toContain(`UID:appointment-${firstAppointmentId}@simak`);
      expect(firstEvent).toContain('DTEND:');

      await navigateToAssignment(instructorPage, 'instructor', fixture.assignmentId);
      const replacementStart = futureLocalInput(72);
      const replacementEnd = futureLocalInput(73);
      await publishSlot(instructorPage, replacementStart, replacementEnd, fixture.checkpointName);
      const [replacementId] = await waitForAppointment(fixture.assignmentId, 'available');
      expect(replacementId).not.toBe(firstAppointmentId);

      await navigateToAssignment(studentPage, 'student', fixture.assignmentId);
      await studentPage.getByRole('button', { name: /Reschedule/i }).click();
      await waitForAppointmentStatus(firstAppointmentId, 'booked');
      await waitForAppointmentStatus(replacementId, 'cancelled');
      const afterReschedule = await getAppointmentTimes(firstAppointmentId);
      const rescheduledFeed = await studentPage.request.get(
        `/api/calendar/ics?token=${encodeURIComponent(calendarToken)}`,
      );
      const rescheduledBody = await rescheduledFeed.text();
      const rescheduledEvent = appointmentEvent(rescheduledBody, firstAppointmentId);
      expect(rescheduledEvent).toContain(`UID:appointment-${firstAppointmentId}@simak`);
      expect(rescheduledEvent).not.toEqual(firstEvent);
      expect(rescheduledEvent).toContain(`DTSTART:${toUtcCalendarValue(afterReschedule.startAt)}`);
      await waitForNotification(firstAppointmentId, 'appointment_rescheduled', STUDENT_EMAIL);

      await studentPage.getByRole('button', { name: /Cancel/i }).click();
      await studentPage
        .getByRole('dialog')
        .getByRole('button', { name: /Confirm/i })
        .click();
      await waitForAppointmentStatus(firstAppointmentId, 'cancelled');
      const afterCancelFeed = await studentPage.request.get(
        `/api/calendar/ics?token=${encodeURIComponent(calendarToken)}`,
      );
      const afterCancelBody = await afterCancelFeed.text();
      expect(afterCancelBody).not.toContain(`UID:appointment-${firstAppointmentId}@simak`);
      await waitForNotification(firstAppointmentId, 'appointment_cancelled', STUDENT_EMAIL);

      const noShowStart = futureLocalInput(48);
      const noShowEnd = futureLocalInput(49);
      await navigateToAssignment(instructorPage, 'instructor', fixture.assignmentId);
      await publishSlot(instructorPage, noShowStart, noShowEnd, fixture.checkpointName);
      const [noShowAppointmentId] = await waitForAppointment(fixture.assignmentId, 'available');
      await navigateToAssignment(studentPage, 'student', fixture.assignmentId);
      await studentPage.getByRole('button', { name: /Book/i }).first().click();
      await waitForAppointmentStatus(noShowAppointmentId, 'booked');
      await setAppointmentEnded(noShowAppointmentId);
      await navigateToAssignment(instructorPage, 'instructor', fixture.assignmentId);
      await instructorPage.getByRole('button', { name: /Mark no.?show/i }).click();
      await waitForAppointmentStatus(noShowAppointmentId, 'no_show');
      await waitForNotification(noShowAppointmentId, 'appointment_no_show', STUDENT_EMAIL);

      expect(
        await studentPage.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    } finally {
      await instructorContext.close();
      await studentContext.close();
    }
  });

  test('completes an appointment and explicitly records then verifies consultation evidence', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const instructorContext = await browser.newContext({ timezoneId: 'America/New_York' });
    const studentContext = await browser.newContext({ timezoneId: 'America/New_York' });
    const instructorPage = await instructorContext.newPage();
    const studentPage = await studentContext.newPage();

    try {
      await loginAsRole(instructorPage, 'instructor');
      await loginAsRole(studentPage, 'student');
      await navigateToAssignment(instructorPage, 'instructor', fixture.assignmentId);
      await publishSlot(
        instructorPage,
        futureLocalInput(96),
        futureLocalInput(97),
        fixture.checkpointName,
      );
      const [completedAppointmentId] = await waitForAppointment(fixture.assignmentId, 'available');

      await navigateToAssignment(studentPage, 'student', fixture.assignmentId);
      await studentPage.getByRole('button', { name: /Book/i }).first().click();
      await waitForAppointmentStatus(completedAppointmentId, 'booked');
      await setAppointmentEnded(completedAppointmentId);

      await navigateToAssignment(instructorPage, 'instructor', fixture.assignmentId);
      await instructorPage.getByRole('button', { name: /Mark completed/i }).click();
      await waitForAppointmentStatus(completedAppointmentId, 'completed');
      await waitForNotification(completedAppointmentId, 'appointment_completed', STUDENT_EMAIL);

      await navigateToAssignment(studentPage, 'student', fixture.assignmentId);
      await studentPage.getByRole('button', { name: /Record consultation/i }).click();
      await expect(studentPage.getByRole('combobox').first()).toContainText(
        String(fixture.checkpointId),
      );
      await studentPage
        .locator('textarea')
        .fill('Appointment evidence recorded explicitly from the completed session.');
      await studentPage.getByRole('button', { name: /Log consultation/i }).click();
      const consultationId = await waitForConsultationStatus(fixture.checkpointId, 'pending');
      expect(consultationId).toBeGreaterThan(0);

      await navigateToAssignment(instructorPage, 'instructor', fixture.assignmentId);
      await expect(instructorPage.getByText(/Pending Verification/i).first()).toBeVisible();
      await instructorPage.getByRole('button', { name: fixture.checkpointName }).last().click();
      const dialog = instructorPage.getByRole('dialog');
      await dialog.getByRole('button', { name: /Verify/i }).click();
      await waitForConsultationStatus(fixture.checkpointId, 'verified');
    } finally {
      await instructorContext.close();
      await studentContext.close();
    }
  });

  test('keeps role and private calendar boundaries generic', async ({ browser }) => {
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    try {
      await loginAsRole(studentPage, 'student');
      const unauthorized = await studentPage.request.get('/api/calendar/ics?token=invalid');
      expect(unauthorized.status()).toBe(401);
      expect(await unauthorized.text()).not.toContain(calendarToken);

      await studentPage.goto(`/instructor/assignments/${fixture.assignmentId}`);
      await expect(studentPage).not.toHaveURL(
        new RegExp(`/instructor/assignments/${fixture.assignmentId}`),
      );
    } finally {
      await studentContext.close();
    }
  });
});
