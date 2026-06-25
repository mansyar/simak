import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { consultations } from '../db/schema/consultations';
import { checkpoints } from '../db/schema/assignments';
import { getSessionFromHeaders } from './auth';
import { verifyAssignmentAccess } from './ownership';
import { serverError, ErrorCode } from '../lib/errors';
import type { z } from 'zod';
import type { ListVerifiedCountsSchema } from './consultations';

type ListVerifiedCountsInput = z.infer<typeof ListVerifiedCountsSchema>;

export async function listVerifiedCountsHandler(args: { data: ListVerifiedCountsInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId } = args.data;
  const db = getDb();

  try {
    const role = session.user.role;

    const accessError = await verifyAssignmentAccess(db, assignmentId, session);
    if (accessError) return accessError;

    const checkpointConditions = [eq(checkpoints.assignmentId, assignmentId)];
    if (role === 'student') {
      checkpointConditions.push(eq(checkpoints.studentId, session.user.id));
    }

    const checkpointData = await db
      .select({
        id: checkpoints.id,
        name: checkpoints.name,
        order: checkpoints.order,
        minConsultations: checkpoints.minConsultations,
      })
      .from(checkpoints)
      .where(and(...checkpointConditions))
      .orderBy(checkpoints.order);

    const result = [];
    for (const cp of checkpointData) {
      const consConditions = [
        eq(consultations.checkpointId, cp.id),
        eq(consultations.status, 'verified'),
      ];
      if (role === 'student') {
        consConditions.push(eq(consultations.studentId, session.user.id));
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(consultations)
        .where(and(...consConditions));

      result.push({
        checkpointId: cp.id,
        checkpointName: cp.name,
        verifiedCount: Number(countResult?.count ?? 0),
        minConsultations: cp.minConsultations ?? 0,
      });
    }

    return { counts: result };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listVerifiedCountsHandler',
    });
  }
}
