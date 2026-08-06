// Server-only handler for student dashboard data
import { eq, and, asc, desc, sql, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { sectionEnrollments } from '../db/schema/academic-context';
import { assignmentTemplates } from '../db/schema/templates';
import { reviews, submissions } from '../db/schema/submissions';
import { revisionActionItems } from '../db/schema/revision-action-items';
import { consultations } from '../db/schema/consultations';
import { getSessionFromHeaders } from './auth';
import { computeEffectiveDeadline } from './due-dates.server';
import { serverError, ErrorCode } from '@/lib/errors';
import { isStudent } from '@/lib/session-guards';
import {
  resolveStudentNextActions,
  type StudentActionCandidate,
  type StudentRevisionActionItem,
} from '@/lib/student-next-actions';

/**
 * Get all data for the student dashboard.
 */
export async function getStudentDashboardDataHandler() {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  const studentId = session.user.id;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeStudentSection = and(
      eq(sectionEnrollments.userId, studentId),
      eq(sectionEnrollments.role, 'student'),
      eq(sectionEnrollments.isActive, true),
    );

    // Group A (independent): active assignments, upcoming deadlines, pending reviews, consultations
    const [activeAssignments, upcomingDeadlines, pendingReviews, consultationReminders] =
      await Promise.all([
        db
          .select({
            id: assignments.id,
            title: assignments.title,
            sectionId: assignments.sectionId,
            status: assignments.status,
            finalDeadline: assignments.finalDeadline,
            templateName: assignmentTemplates.name,
            templateType: assignmentTemplates.type,
          })
          .from(assignmentStudents)
          .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
          .innerJoin(
            sectionEnrollments,
            and(eq(sectionEnrollments.sectionId, assignments.sectionId), activeStudentSection),
          )
          .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
          .where(
            and(
              eq(assignmentStudents.studentId, studentId),
              eq(assignments.status, 'active'),
              isNull(assignments.deletedAt),
            ),
          )
          .orderBy(assignments.finalDeadline)
          .limit(20),
        db
          .select({
            assignmentId: assignments.id,
            assignmentTitle: assignments.title,
            checkpointId: checkpoints.id,
            checkpointName: checkpoints.name,
            dueDate: checkpoints.dueDate,
            minConsultations: checkpoints.minConsultations,
            state: checkpoints.state,
          })
          .from(checkpoints)
          .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
          .innerJoin(
            sectionEnrollments,
            and(eq(sectionEnrollments.sectionId, assignments.sectionId), activeStudentSection),
          )
          .where(
            and(
              eq(checkpoints.studentId, studentId),
              eq(assignments.status, 'active'),
              isNull(assignments.deletedAt),
              sql`${checkpoints.state} != 'passed'`,
            ),
          )
          .orderBy(checkpoints.dueDate),
        db
          .select({
            submissionId: submissions.id,
            assignmentId: assignments.id,
            checkpointId: checkpoints.id,
            assignmentTitle: assignments.title,
            checkpointName: checkpoints.name,
            submittedAt: submissions.uploadedAt,
            state: checkpoints.state,
          })
          .from(submissions)
          .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
          .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
          .innerJoin(
            sectionEnrollments,
            and(eq(sectionEnrollments.sectionId, assignments.sectionId), activeStudentSection),
          )
          .where(
            and(
              eq(checkpoints.studentId, studentId),
              eq(assignments.status, 'active'),
              isNull(assignments.deletedAt),
            ),
          )
          .orderBy(desc(submissions.uploadedAt)),
        db
          .select({
            assignmentId: consultations.assignmentId,
            checkpointId: consultations.checkpointId,
            assignmentTitle: assignments.title,
            checkpointName: checkpoints.name,
            consultationDate: consultations.createdAt,
            consultationId: consultations.id,
            status: consultations.status,
          })
          .from(consultations)
          .innerJoin(assignments, eq(consultations.assignmentId, assignments.id))
          .innerJoin(checkpoints, eq(consultations.checkpointId, checkpoints.id))
          .innerJoin(
            sectionEnrollments,
            and(eq(sectionEnrollments.sectionId, assignments.sectionId), activeStudentSection),
          )
          .where(
            and(
              eq(consultations.studentId, studentId),
              eq(assignments.status, 'active'),
              isNull(assignments.deletedAt),
            ),
          )
          .orderBy(desc(consultations.createdAt)),
      ]);

    // Fetch checkpoints per assignment for progress calculation (depends on Group A assignmentIds)
    const assignmentIds = activeAssignments.map((a) => a.id);
    const checkpointsByAssignment = new Map<
      number,
      { state: string; dueDate: Date | null; name: string; order: number }[]
    >();

    if (assignmentIds.length > 0) {
      const allCheckpoints = await db
        .select({
          assignmentId: checkpoints.assignmentId,
          name: checkpoints.name,
          state: checkpoints.state,
          dueDate: checkpoints.dueDate,
          order: checkpoints.order,
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
          order: cp.order,
        });
      });
    }

    // Load all plan items in one scoped query, then retain only the newest
    // review with items for each checkpoint. Historical items never carry
    // forward into the current plan context.
    const revisionActionItemRows = await db
      .select({
        checkpointId: checkpoints.id,
        reviewId: reviews.id,
        itemText: revisionActionItems.itemText,
        addressedAt: revisionActionItems.addressedAt,
      })
      .from(revisionActionItems)
      .innerJoin(reviews, eq(revisionActionItems.reviewId, reviews.id))
      .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
      .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .innerJoin(
        sectionEnrollments,
        and(eq(sectionEnrollments.sectionId, assignments.sectionId), activeStudentSection),
      )
      .where(
        and(
          eq(checkpoints.studentId, studentId),
          eq(reviews.decision, 'revise'),
          eq(assignments.status, 'active'),
          isNull(assignments.deletedAt),
        ),
      )
      .orderBy(
        desc(reviews.createdAt),
        desc(reviews.id),
        asc(revisionActionItems.order),
        asc(revisionActionItems.id),
      );

    const currentPlanReviewByCheckpoint = new Map<number, number>();
    const currentPlanItemsByCheckpoint = new Map<number, StudentRevisionActionItem[]>();
    for (const row of revisionActionItemRows) {
      const currentReviewId = currentPlanReviewByCheckpoint.get(row.checkpointId);
      if (currentReviewId === undefined) {
        currentPlanReviewByCheckpoint.set(row.checkpointId, row.reviewId);
        currentPlanItemsByCheckpoint.set(row.checkpointId, []);
      }
      if (currentPlanReviewByCheckpoint.get(row.checkpointId) === row.reviewId) {
        currentPlanItemsByCheckpoint.get(row.checkpointId)!.push({
          itemText: row.itemText,
          addressedAt: row.addressedAt,
        });
      }
    }

    const activeAssignmentsWithProgress = activeAssignments.map((a) => {
      const cps = checkpointsByAssignment.get(a.id) ?? [];
      const totalCount = cps.length;
      const passedCount = cps.filter((cp) => cp.state === 'passed').length;
      const currentState = cps.find((cp) => cp.state !== 'passed')?.state ?? 'passed';

      const effectiveDeadline = computeEffectiveDeadline(cps);

      return {
        id: a.id,
        title: a.title,
        sectionId: a.sectionId,
        status: a.status,
        finalDeadline: a.finalDeadline,
        templateName: a.templateName,
        templateType: a.templateType,
        progressPercent: totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0,
        currentState,
        effectiveDeadline,
      };
    });

    // Sort: soonest effective deadline first, then least progress
    activeAssignmentsWithProgress.sort((a, b) => {
      const dateA = a.effectiveDeadline?.getTime() ?? 0;
      const dateB = b.effectiveDeadline?.getTime() ?? 0;
      if (dateA !== dateB) return dateA - dateB;
      return a.progressPercent - b.progressPercent;
    });

    const latestSubmissionByCheckpoint = new Map<number, number>();
    for (const submission of pendingReviews) {
      if (!latestSubmissionByCheckpoint.has(submission.checkpointId)) {
        latestSubmissionByCheckpoint.set(submission.checkpointId, submission.submissionId);
      }
    }

    const verifiedConsultationCounts = new Map<number, number>();
    for (const consultation of consultationReminders) {
      if (consultation.status === 'verified') {
        verifiedConsultationCounts.set(
          consultation.checkpointId,
          (verifiedConsultationCounts.get(consultation.checkpointId) ?? 0) + 1,
        );
      }
    }

    const now = new Date();
    const deadlines = upcomingDeadlines
      .filter((d) => d.state !== 'passed')
      .map((d) => ({
        assignmentId: d.assignmentId,
        checkpointId: d.checkpointId,
        assignmentTitle: d.assignmentTitle,
        checkpointName: d.checkpointName,
        dueDate: d.dueDate ? d.dueDate.toISOString() : null,
        state: d.state,
        isOverdue: d.dueDate ? d.dueDate < now : false,
        daysRemaining: d.dueDate
          ? Math.ceil((d.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      }));

    const actionCandidates: StudentActionCandidate[] = upcomingDeadlines.map((candidate) => ({
      assignmentId: candidate.assignmentId,
      assignmentTitle: candidate.assignmentTitle,
      checkpointId: candidate.checkpointId,
      checkpointName: candidate.checkpointName,
      state: candidate.state,
      dueDate: candidate.dueDate,
      minConsultations: candidate.minConsultations,
      verifiedConsultationCount: verifiedConsultationCounts.get(candidate.checkpointId) ?? 0,
      submissionId: latestSubmissionByCheckpoint.get(candidate.checkpointId) ?? null,
      revisionActionItems: currentPlanItemsByCheckpoint.get(candidate.checkpointId),
    }));

    const nextActions = resolveStudentNextActions(actionCandidates, { now });

    const pendingReviewRows = pendingReviews.filter(
      (review) =>
        (review.state === 'under_review' || review.state === undefined) &&
        review.submittedAt !== null &&
        review.submittedAt >= thirtyDaysAgo,
    );

    return {
      activeAssignments: activeAssignmentsWithProgress,
      upcomingDeadlines: deadlines.slice(0, 5),
      pendingReviews: pendingReviewRows.map((pr) => ({
        submissionId: pr.submissionId,
        assignmentId: pr.assignmentId,
        checkpointId: pr.checkpointId,
        assignmentTitle: pr.assignmentTitle,
        checkpointName: pr.checkpointName,
        submittedAt: pr.submittedAt,
        waitTimeDays: Math.floor(
          (Date.now() - (pr.submittedAt?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24),
        ),
      })),
      consultationReminders: consultationReminders
        .filter((cr) => cr.status === 'pending' || cr.status === undefined)
        .map((cr) => ({
          consultationId: cr.consultationId,
          assignmentId: cr.assignmentId,
          checkpointId: cr.checkpointId,
          assignmentTitle: cr.assignmentTitle,
          checkpointName: cr.checkpointName,
          consultationDate: cr.consultationDate,
        })),
      nextActions,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getStudentDashboardDataHandler',
    });
  }
}
