import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { consultations } from '../db/schema/consultations';
import { checkpoints } from '../db/schema/assignments';
import { enqueueEventEmail } from './event-email';
import { buildConsultationVerifiedHtml, buildConsultationRejectedHtml } from './email-templates';
import { logger } from '@/lib/logger';

export async function sendConsultationEmail(
  data: { studentId: string; assignmentId: number },
  instructorName: string,
  consultationId: number,
  verified: boolean,
  rejectionReason?: string,
): Promise<void> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ checkpointName: checkpoints.name })
      .from(consultations)
      .innerJoin(checkpoints, eq(consultations.checkpointId, checkpoints.id))
      .where(eq(consultations.id, consultationId))
      .limit(1);

    await enqueueEventEmail({
      recipientId: data.studentId,
      subjectKey: verified
        ? 'emails.subjects.consultationVerified'
        : 'emails.subjects.consultationRejected',
      templateType: verified ? 'consultation_verified' : 'consultation_rejected',
      buildBody: (locale) =>
        verified
          ? buildConsultationVerifiedHtml({
              instructorName,
              checkpointName: row?.checkpointName ?? '',
              assignmentId: data.assignmentId,
              locale,
            })
          : buildConsultationRejectedHtml({
              instructorName,
              checkpointName: row?.checkpointName ?? '',
              assignmentId: data.assignmentId,
              rejectionReason: rejectionReason ?? '',
              locale,
            }),
    });
  } catch (err) {
    logger.error({
      event: 'advisory_failed',
      handler: 'sendConsultationEmail',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
