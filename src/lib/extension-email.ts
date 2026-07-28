import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { enqueueEventEmail } from './event-email';
import {
  buildExtensionApprovedHtml,
  buildExtensionRejectedHtml,
  buildExtensionRequestedHtml,
} from './email-templates';
import { logger } from '@/lib/logger';

export async function sendExtensionApprovedEmail(opts: {
  studentId: string;
  instructorName: string;
  assignmentId: number;
  extensionDays: number;
  checkpointId?: number | null;
  notificationType?: string;
}): Promise<void> {
  try {
    const db = getDb();
    const [assignment] = await db
      .select({ title: assignments.title })
      .from(assignments)
      .where(eq(assignments.id, opts.assignmentId))
      .limit(1);

    let newDeadline = '';
    if (opts.checkpointId) {
      const [cp] = await db
        .select({ dueDate: checkpoints.dueDate })
        .from(checkpoints)
        .where(eq(checkpoints.id, opts.checkpointId))
        .limit(1);
      if (cp?.dueDate) {
        newDeadline = cp.dueDate.toISOString();
      }
    }

    await enqueueEventEmail({
      recipientId: opts.studentId,
      subjectKey: 'emails.subjects.extensionApproved',
      templateType: 'extension_approved',
      notificationType: opts.notificationType,
      buildBody: (locale) =>
        buildExtensionApprovedHtml({
          instructorName: opts.instructorName,
          assignmentName: assignment?.title ?? '',
          assignmentId: opts.assignmentId,
          extensionDays: opts.extensionDays,
          newDeadline,
          locale,
        }),
    });
  } catch (err) {
    logger.error({
      event: 'advisory_failed',
      handler: 'sendExtensionApprovedEmail',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendExtensionRejectedEmail(opts: {
  studentId: string;
  instructorName: string;
  assignmentId: number;
  rejectionReason?: string | null;
}): Promise<void> {
  try {
    const db = getDb();
    const [assignment] = await db
      .select({ title: assignments.title })
      .from(assignments)
      .where(eq(assignments.id, opts.assignmentId))
      .limit(1);

    await enqueueEventEmail({
      recipientId: opts.studentId,
      subjectKey: 'emails.subjects.extensionRejected',
      templateType: 'extension_rejected',
      buildBody: (locale) =>
        buildExtensionRejectedHtml({
          instructorName: opts.instructorName,
          assignmentName: assignment?.title ?? '',
          assignmentId: opts.assignmentId,
          rejectionReason: opts.rejectionReason ?? '',
          locale,
        }),
    });
  } catch (err) {
    logger.error({
      event: 'advisory_failed',
      handler: 'sendExtensionRejectedEmail',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendExtensionRequestedEmail(opts: {
  instructorId: string;
  studentName: string;
  assignmentId: number;
  category: string;
  durationRequested: number;
}): Promise<void> {
  try {
    const db = getDb();
    const [assignment] = await db
      .select({ title: assignments.title })
      .from(assignments)
      .where(eq(assignments.id, opts.assignmentId))
      .limit(1);

    await enqueueEventEmail({
      recipientId: opts.instructorId,
      subjectKey: 'emails.subjects.extensionRequested',
      templateType: 'extension_requested',
      buildBody: (locale) =>
        buildExtensionRequestedHtml({
          studentName: opts.studentName,
          assignmentName: assignment?.title ?? '',
          assignmentId: opts.assignmentId,
          category: opts.category,
          durationRequested: opts.durationRequested,
          locale,
        }),
    });
  } catch (err) {
    logger.error({
      event: 'advisory_failed',
      handler: 'sendExtensionRequestedEmail',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
