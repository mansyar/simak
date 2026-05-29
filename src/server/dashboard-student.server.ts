// Server-only handler for student dashboard data
import { eq, and, desc, sql, inArray, isNull, gte } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { assignmentTemplates } from '../db/schema/templates';
import { submissions } from '../db/schema/submissions';
import { consultations } from '../db/schema/consultations';
import { getSessionFromHeaders } from './auth';
import type { NonNullableSession } from '../lib/types';

function isStudent(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'student';
}

/**
 * Get all data for the student dashboard.
 */
export async function getStudentDashboardDataHandler() {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return { error: 'Unauthorized' };
  }

  const db = getDb();
  const studentId = session.user.id;

  try {
    // 1. Active assignments overview
    const activeAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        finalDeadline: assignments.finalDeadline,
        templateName: assignmentTemplates.name,
        templateType: assignmentTemplates.type,
      })
      .from(assignmentStudents)
      .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
      .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
      .where(and(eq(assignmentStudents.studentId, studentId), isNull(assignments.deletedAt)))
      .orderBy(assignments.finalDeadline);

    // Fetch checkpoints per assignment for progress calculation
    const assignmentIds = activeAssignments.map((a) => a.id);
    const checkpointsByAssignment = new Map<
      number,
      { state: string; dueDate: Date | null; name: string }[]
    >();

    if (assignmentIds.length > 0) {
      const allCheckpoints = await db
        .select({
          assignmentId: checkpoints.assignmentId,
          name: checkpoints.name,
          state: checkpoints.state,
          dueDate: checkpoints.dueDate,
        })
        .from(checkpoints)
        .where(
          and(
            inArray(checkpoints.assignmentId, assignmentIds),
            eq(checkpoints.studentId, studentId),
          ),
        )
        .orderBy(checkpoints.order);

      allCheckpoints.forEach((cp) => {
        if (!checkpointsByAssignment.has(cp.assignmentId)) {
          checkpointsByAssignment.set(cp.assignmentId, []);
        }
        checkpointsByAssignment.get(cp.assignmentId)!.push({
          state: cp.state,
          dueDate: cp.dueDate,
          name: cp.name,
        });
      });
    }

    const activeAssignmentsWithProgress = activeAssignments.map((a) => {
      const cps = checkpointsByAssignment.get(a.id) ?? [];
      const totalCount = cps.length;
      const passedCount = cps.filter((cp) => cp.state === 'passed').length;
      const currentState = cps.find((cp) => cp.state !== 'passed')?.state ?? 'passed';
      return {
        id: a.id,
        title: a.title,
        finalDeadline: a.finalDeadline,
        templateName: a.templateName,
        templateType: a.templateType,
        progressPercent: totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0,
        currentState,
      };
    });

    // Sort: soonest deadline first, then least progress
    activeAssignmentsWithProgress.sort((a, b) => {
      const dateA = a.finalDeadline?.getTime() ?? 0;
      const dateB = b.finalDeadline?.getTime() ?? 0;
      if (dateA !== dateB) return dateA - dateB;
      return a.progressPercent - b.progressPercent;
    });

    // 2. Upcoming deadlines (next 5 upcoming due dates)
    // After Phase 1 backfill, all checkpoints have real dueDates
    const upcomingDeadlines = await db
      .select({
        assignmentId: assignments.id,
        assignmentTitle: assignments.title,
        checkpointName: checkpoints.name,
        dueDate: checkpoints.dueDate,
        state: checkpoints.state,
      })
      .from(checkpoints)
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .where(and(eq(checkpoints.studentId, studentId), isNull(assignments.deletedAt)))
      .orderBy(checkpoints.dueDate)
      .limit(5);

    const now = new Date();
    const deadlines = upcomingDeadlines.map((d) => ({
      assignmentId: d.assignmentId,
      assignmentTitle: d.assignmentTitle,
      checkpointName: d.checkpointName,
      dueDate: d.dueDate ?? new Date(),
      state: d.state,
      isOverdue: (d.dueDate ?? new Date()) < now,
    }));

    // 3. Pending reviews — submissions under instructor review (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pendingReviews = await db
      .select({
        submissionId: submissions.id,
        assignmentTitle: assignments.title,
        checkpointName: checkpoints.name,
        submittedAt: submissions.uploadedAt,
      })
      .from(submissions)
      .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .where(
        and(
          eq(checkpoints.studentId, studentId),
          isNull(assignments.deletedAt),
          gte(submissions.uploadedAt, thirtyDaysAgo),
          sql`${checkpoints.state} = 'under_review'`,
        ),
      )
      .orderBy(desc(submissions.uploadedAt));

    // 4. Consultation reminders — pending consultations
    const consultationReminders = await db
      .select({
        assignmentId: consultations.assignmentId,
        assignmentTitle: assignments.title,
        checkpointName: checkpoints.name,
        consultationDate: consultations.createdAt,
        consultationId: consultations.id,
      })
      .from(consultations)
      .innerJoin(assignments, eq(consultations.assignmentId, assignments.id))
      .innerJoin(checkpoints, eq(consultations.checkpointId, checkpoints.id))
      .where(
        and(
          eq(consultations.studentId, studentId),
          eq(consultations.status, 'pending'),
          isNull(assignments.deletedAt),
        ),
      )
      .orderBy(desc(consultations.createdAt));

    return {
      activeAssignments: activeAssignmentsWithProgress,
      upcomingDeadlines: deadlines,
      pendingReviews: pendingReviews.map((pr) => ({
        submissionId: pr.submissionId,
        assignmentTitle: pr.assignmentTitle,
        checkpointName: pr.checkpointName,
        submittedAt: pr.submittedAt,
        waitTimeDays: Math.floor(
          (Date.now() - (pr.submittedAt?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24),
        ),
      })),
      consultationReminders: consultationReminders.map((cr) => ({
        consultationId: cr.consultationId,
        assignmentTitle: cr.assignmentTitle,
        checkpointName: cr.checkpointName,
        consultationDate: cr.consultationDate,
      })),
    };
  } catch (err) {
    console.error('Failed to get student dashboard data:', err);
    return { error: 'Internal Server Error' };
  }
}
