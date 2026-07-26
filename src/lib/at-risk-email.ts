import type { Locales } from '../i18n/types';
import { enqueueEventEmail } from './event-email';
import { buildStudentAtRiskHtml } from './email-templates';

/**
 * Sends a student-at-risk alert email to the instructor.
 * Advisory — never throws.
 */
export async function sendStudentAtRiskEmail(opts: {
  recipientId: string;
  studentName: string;
  assignmentTitle: string;
  assignmentId: number;
  riskLevel: string;
  riskFactors: string;
}): Promise<void> {
  await enqueueEventEmail({
    recipientId: opts.recipientId,
    subjectKey: 'emails.subjects.studentAtRisk',
    templateType: 'student_at_risk',
    subjectParams: {
      studentName: opts.studentName,
      assignmentTitle: opts.assignmentTitle,
      riskLevel: opts.riskLevel,
      riskFactors: opts.riskFactors,
    },
    buildBody: (locale: Locales) =>
      buildStudentAtRiskHtml({
        studentName: opts.studentName,
        assignmentTitle: opts.assignmentTitle,
        assignmentId: opts.assignmentId,
        riskLevel: opts.riskLevel,
        riskFactors: opts.riskFactors,
        locale,
      }),
  });
}
