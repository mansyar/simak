// Server-only admin mutations for academic-record configuration.
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { academicTerms } from '@/db/schema/academic-context';
import { academicRecordPolicies } from '@/db/schema/academic-records';
import { assignments } from '@/db/schema/assignments';
import { logAuditEvent } from '@/lib/audit';
import { ErrorCode, isServerError, serverError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { isAdmin } from '@/lib/session-guards';
import { parseAcademicRecordPolicy } from '@/lib/academic-record-policy';
import { getSessionFromHeaders } from './auth';
import type {
  AppendAcademicRecordPolicySchema,
  DesignateTranscriptSourceSchema,
} from './academic-records';
import type { z } from 'zod';

export async function designateTranscriptSourceHandler(args: {
  data: z.infer<typeof DesignateTranscriptSourceSchema>;
}) {
  const session = await getSessionFromHeaders();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  if (!isAdmin(session)) return serverError(ErrorCode.FORBIDDEN, 'Forbidden');

  try {
    const result = await getDb().transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${'academic-records:section:' + args.data.sectionId}))`,
      );
      const [assignment] = await tx
        .select({ id: assignments.id, sectionId: assignments.sectionId })
        .from(assignments)
        .where(
          and(
            eq(assignments.id, args.data.assignmentId),
            eq(assignments.sectionId, args.data.sectionId),
            isNull(assignments.deletedAt),
          ),
        )
        .for('update', { of: assignments })
        .limit(1);

      if (!assignment) return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');

      await tx
        .update(assignments)
        .set({ isTranscriptSource: false })
        .where(
          and(
            eq(assignments.sectionId, args.data.sectionId),
            eq(assignments.isTranscriptSource, true),
          ),
        );
      await tx
        .update(assignments)
        .set({ isTranscriptSource: true })
        .where(eq(assignments.id, args.data.assignmentId));

      return {
        success: true as const,
        sectionId: args.data.sectionId,
        assignmentId: args.data.assignmentId,
      };
    });

    if (isServerError(result)) return result;
    await writeAdminAudit('designateTranscriptSourceHandler', {
      actorId: session.user.id,
      action: 'academic_record.transcript_source_designated',
      entityType: 'assignment',
      entityId: String(args.data.assignmentId),
      details: { sectionId: args.data.sectionId },
    });
    return result;
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'designateTranscriptSourceHandler',
    });
  }
}

export async function appendAcademicRecordPolicyHandler(args: {
  data: z.infer<typeof AppendAcademicRecordPolicySchema>;
}) {
  const session = await getSessionFromHeaders();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  if (!isAdmin(session)) return serverError(ErrorCode.FORBIDDEN, 'Forbidden');

  try {
    const policy = parseAcademicRecordPolicy(args.data);
    const result = await getDb().transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('academic-records:policy-version'))`,
      );
      const [term] = await tx
        .select({ id: academicTerms.id })
        .from(academicTerms)
        .where(eq(academicTerms.id, args.data.effectiveTermId))
        .limit(1);
      if (!term) return serverError(ErrorCode.NOT_FOUND, 'Academic term not found');

      const existingPolicies = await tx
        .select({ version: academicRecordPolicies.version })
        .from(academicRecordPolicies)
        .for('update', { of: academicRecordPolicies });
      const version = Math.max(0, ...existingPolicies.map((row) => row.version)) + 1;
      const [created] = await tx
        .insert(academicRecordPolicies)
        .values({
          version,
          effectiveTermId: term.id,
          gradePoints: policy.gradePoints,
          roundingScale: policy.roundingScale,
          isActive: true,
        })
        .returning({
          id: academicRecordPolicies.id,
          version: academicRecordPolicies.version,
          effectiveTermId: academicRecordPolicies.effectiveTermId,
          gradePoints: academicRecordPolicies.gradePoints,
          roundingScale: academicRecordPolicies.roundingScale,
        });

      if (!created) return serverError(ErrorCode.INTERNAL, 'Policy insert returned no row');
      return { success: true as const, policy: created };
    });

    if (isServerError(result)) return result;
    await writeAdminAudit('appendAcademicRecordPolicyHandler', {
      actorId: session.user.id,
      action: 'academic_record.policy_appended',
      entityType: 'academic_record_policy',
      entityId: String(result.policy.version),
      details: { effectiveTermId: result.policy.effectiveTermId },
    });
    return result;
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'appendAcademicRecordPolicyHandler',
    });
  }
}

async function writeAdminAudit(handler: string, event: Parameters<typeof logAuditEvent>[0]) {
  try {
    await logAuditEvent(event);
  } catch (error) {
    logger.error({
      event: 'advisory_failed',
      handler,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
