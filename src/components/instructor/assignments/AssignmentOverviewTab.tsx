import { Calendar, Users, Clipboard, Percent, CheckCircle2 } from 'lucide-react';
import { formatDateShort, formatDateTimeShort } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { ProgressTable } from '@/components/instructor/assignments/ProgressTable';
import { DeadlineManager } from '@/components/reviews/DeadlineManager';
import { useI18n } from '@/routes/__root';

interface AssignmentOverviewStudent {
  id: string;
  name: string;
  email: string;
  progressPercent: number;
  passedCount: number;
  totalCheckpointsCount: number;
  activeCheckpoint: { id: number; name: string; state: string } | null;
  checkpoints: {
    id: number;
    name: string;
    order: number;
    state: string;
    studentId: string;
    dueDate: string | null;
    minConsultations: number | null;
  }[];
}

interface AssignmentOverviewTabProps {
  assignment: {
    id: number;
    title: string;
    description: string | null;
    finalDeadline: string;
    createdAt: string;
    templateName: string;
    templateType: string;
    instructorId: string;
    students: AssignmentOverviewStudent[];
  };
}

export function AssignmentOverviewTab({ assignment }: AssignmentOverviewTabProps) {
  const { t } = useI18n();

  const totalStudents = assignment.students.length;
  const avgProgress =
    totalStudents > 0
      ? Math.round(
          assignment.students.reduce((sum, s) => sum + s.progressPercent, 0) / totalStudents,
        )
      : 0;
  const completedStudents = assignment.students.filter((s) => s.progressPercent === 100).length;

  return (
    <div className="space-y-6">
      {/* Overview Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t('instructorAssignments.details.totalStudents')}
          value={totalStudents}
          icon={Users}
          color="primary"
        />

        <MetricCard
          label={t('instructorAssignments.averageProgress')}
          value={`${avgProgress}%`}
          icon={Percent}
          color="info"
        />

        <MetricCard
          label={t('instructorAssignments.completedCohort')}
          value={`${completedStudents} / ${totalStudents}`}
          icon={CheckCircle2}
          color="success"
        />

        <MetricCard
          label={t('instructorAssignments.details.deadline')}
          value={formatDateShort(assignment.finalDeadline)}
          icon={Calendar}
          color="warning"
        />
      </div>

      {/* Details Meta Block */}
      <Card>
        <CardHeader>
          <CardTitle>{t('instructorAssignments.details.overview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {t('instructorAssignments.details.template')}
              </span>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Clipboard className="h-4 w-4 text-primary/60" />
                {assignment.templateName}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {t('instructorAssignments.details.type')}
              </span>
              <div className="font-medium text-foreground">{assignment.templateType}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {t('instructorAssignments.details.created')}
              </span>
              <div className="font-medium text-foreground">
                {formatDateTimeShort(assignment.createdAt)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-foreground">
            {t('instructorAssignments.details.studentsProgress')}
          </h2>
        </div>
        <ProgressTable students={assignment.students} />
      </div>

      {/* Deadline Manager */}
      <DeadlineManager students={assignment.students} assignmentId={assignment.id} />
    </div>
  );
}
