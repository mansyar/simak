import { eq, and, sql, inArray, isNull } from 'drizzle-orm';
import { getDb, type Db } from '../db/index';
import { consultations } from '../db/schema/consultations';
import { assignments, checkpoints } from '../db/schema/assignments';
import { getSessionFromHeaders } from './auth';
import { verifyAssignmentAccess } from './ownership';
import { serverError, ErrorCode } from '../lib/errors';
import type { z } from 'zod';
import type { ListVerifiedCountsSchema } from './consultations';

type ListVerifiedCountsInput = z.infer<typeof ListVerifiedCountsSchema>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export async function fetchConsultationForUpdate(
  tx: Tx,
  consultationId: number,
  instructorId: string,
) {
  return tx
    .select({
      id: consultations.id,
      status: consultations.status,
      studentId: consultations.studentId,
      assignmentId: consultations.assignmentId,
      instructorId: assignments.instructorId,
    })
    .from(consultations)
    .innerJoin(assignments, eq(consultations.assignmentId, assignments.id))
    .where(
      and(
        eq(consultations.id, consultationId),
        eq(assignments.instructorId, instructorId),
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
      ),
    )
    .limit(1)
    .for('update', { of: consultations });
}

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

    if (checkpointData.length === 0) {
      return { counts: [] };
    }

    const checkpointIds = checkpointData.map((cp) => cp.id);

    const consConditions = [
      inArray(consultations.checkpointId, checkpointIds),
      eq(consultations.status, 'verified'),
    ];
    if (role === 'student') {
      consConditions.push(eq(consultations.studentId, session.user.id));
    }

    const countData = await db
      .select({
        checkpointId: consultations.checkpointId,
        count: sql<number>`count(*)::int`,
      })
      .from(consultations)
      .where(and(...consConditions))
      .groupBy(consultations.checkpointId);

    const countMap = new Map(countData.map((row) => [row.checkpointId, row.count]));

    const result = checkpointData.map((cp) => ({
      checkpointId: cp.id,
      checkpointName: cp.name,
      verifiedCount: Number(countMap.get(cp.id) ?? 0),
      minConsultations: cp.minConsultations ?? 0,
    }));

    return { counts: result };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listVerifiedCountsHandler',
    });
  }
}
